import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { requirePrivilegedStepUp } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REVOCATION_REASONS, revokeAllSessions } from "@/lib/auth/sessionRevocation";

export const dynamic = "force-dynamic";

const Body = z.strictObject({
  userId: z.string().min(1).max(200),
  reason: z.enum(REVOCATION_REASONS),
  /** Also make the password unusable (account disabled until a new credential is issued). */
  disable: z.boolean().optional(),
});

/**
 * Audited per-account "sign out everywhere" (incident containment). Platform authority plus a recent privileged step-up,
 * as for the other /api/platform/security actions. Every session the account holds, on any device, is refused from its
 * next request; the audit row is written in the same transaction and is required.
 */
export async function POST(req: Request) {
  try {
    const actor = await requireMoePlatformAdmin();
    await requirePrivilegedStepUp(actor);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, schoolId: true } });
    if (!target) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    await revokeAllSessions(prisma, {
      userId: target.id,
      actorId: actor.id,
      schoolId: target.schoolId ?? null,
      reason: parsed.data.reason,
      disable: parsed.data.disable === true,
    });
    return NextResponse.json({ ok: true, revoked: true, disabled: parsed.data.disable === true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
