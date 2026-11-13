import { createHash } from "node:crypto";
import { z } from "zod";
import { requirePlatformAdmin, requirePrivilegedStepUp, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveCanvaOAuthState } from "./canvaOAuth";

const payloadSchema = z.strictObject({ version: z.literal(1), sessionHash: z.string().regex(/^[a-f0-9]{64}$/),
  verifier: z.string().min(1).max(256) });
const fail = (status: number): never => { throw Object.assign(new Error("Canva OAuth authorization refused"), { status }); };

/** Stable across JWT refresh, distinct across account/login/credential/MFA sessions. Never stores a raw session token. */
function sessionHash(session: SessionUser): string {
  if (session.role !== "ADMIN" || session.isPlatformAdmin !== true || !session.id ||
      !Number.isSafeInteger(session.authTime) || session.authTime <= 0 ||
      !Number.isSafeInteger(session.credStamp) || session.credStamp < 0) return fail(403);
  return createHash("sha256").update(JSON.stringify([
    session.id, session.authTime, session.credStamp, session.privilegedSessionId ?? null,
  ])).digest("hex");
}

export async function requireCanvaPlatformSession(): Promise<SessionUser> {
  const session = await requirePlatformAdmin();
  // Preserve the ADMIN namespace's role restriction; a platform flag never widens another role.
  sessionHash(session);
  await requirePrivilegedStepUp(session);
  return session;
}

/** Versioned payload in the existing text field; old unbound pending states require a fresh authorization start. */
export async function saveBoundCanvaOAuthState(input: { state: string; codeVerifier: string; session: SessionUser }) {
  const payload = payloadSchema.parse({ version: 1, sessionHash: sessionHash(input.session), verifier: input.codeVerifier });
  return saveCanvaOAuthState({ state: input.state, codeVerifier: JSON.stringify(payload) });
}

export async function consumeBoundCanvaOAuthState(input: { state: string; session: SessionUser }): Promise<string> {
  const expected = sessionHash(input.session);
  if (!input.state || input.state.length > 256) fail(400);
  const record = await prisma.canvaOAuthState.findUnique({ where: { state: input.state } });
  if (!record || record.expiresAt.getTime() <= Date.now()) return fail(400);
  let raw: unknown;
  try { raw = JSON.parse(record.codeVerifier); } catch { fail(400); }
  const payload = payloadSchema.safeParse(raw);
  if (payload.success === false) return fail(400);
  if (payload.data.sessionHash !== expected) fail(400);

  // Conditional DELETE is the claim. Two reads can race; only one matching, unexpired row can be deleted.
  const claim = await prisma.canvaOAuthState.deleteMany({ where: {
    id: record.id, state: input.state, codeVerifier: record.codeVerifier, expiresAt: { gt: new Date() },
  } });
  if (claim.count !== 1 || record.expiresAt.getTime() <= Date.now()) fail(400);
  return payload.data.verifier;
}

export function canvaOAuthErrorStatus(error: unknown): number {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number" &&
      [400, 401, 403, 409, 503].includes(error.status)) return error.status;
  return 500;
}
