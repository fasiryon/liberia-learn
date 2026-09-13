import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { DiagnosticKind } from "@/lib/learning-authority/governedGrade4Math";

const SESSION_TTL_MS = 30 * 60 * 1000;

export type GovernedDiagnosticSession = Readonly<{
  sessionId: string;
  kind: DiagnosticKind;
  schoolId: string;
  studentId: string;
  studentUserId: string;
  ontologyReleaseId: string;
  ontologyReleaseIdentity: string;
  itemId: string;
  itemVersion: string;
  expiresAt: number;
}>;

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("diagnostic_session_secret_missing");
  }
  return createHash("sha256")
    .update(secret || "liberialearn-local-diagnostic-session")
    .digest();
}

export function diagnosticSessionId(input: {
  kind: DiagnosticKind;
  schoolId: string;
  studentId: string;
  releaseId: string;
  now?: Date;
}) {
  const bucket = input.kind === "INITIAL"
    ? "initial"
    : (input.now ?? new Date()).toISOString().slice(0, 10);
  return "g4diag-" + createHash("sha256")
    .update([input.schoolId, input.studentId, input.releaseId, input.kind, bucket].join(":"))
    .digest("hex");
}

export function sealDiagnosticSession(input: Omit<GovernedDiagnosticSession, "expiresAt">) {
  const session: GovernedDiagnosticSession = Object.freeze({
    ...input,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function openDiagnosticSession(
  token: string,
  expected: { sessionId: string; schoolId: string; studentId: string; studentUserId: string }
) {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= 28) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const session = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()
    ) as GovernedDiagnosticSession;
    if (
      session.expiresAt < Date.now() ||
      session.sessionId !== expected.sessionId ||
      session.schoolId !== expected.schoolId ||
      session.studentId !== expected.studentId ||
      session.studentUserId !== expected.studentUserId
    ) return null;
    return session;
  } catch {
    return null;
  }
}
