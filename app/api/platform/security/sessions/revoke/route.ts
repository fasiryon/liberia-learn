// route-policy: auth=session; scope=platform; authority=platform-admin-enforced-mfa-step-up; rationale=same-origin JSON only; requires PRIVILEGED_MFA_ENFORCEMENT_ENABLED and a recent verified MFA or break-glass step-up, otherwise unavailable; an allowlisted platform admin revokes one account's sessions across schools and optionally disables it (refused by Credentials, Google, Auth0 and every session refresh); required audit in the same transaction; each call is a new revocation, not an idempotent retry
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { hasRecentPrivilegedStepUp, isPrivilegedMfaEnforced } from "@/lib/auth/privilegedIdentity";
import { prisma } from "@/lib/db";
import { REVOCATION_REASONS, revokeAllSessions } from "@/lib/auth/sessionRevocation";
import { assertSameOriginJson } from "@/lib/security/sameOrigin";

export const dynamic = "force-dynamic";

const Body = z.strictObject({
  userId: z.string().min(1).max(200),
  reason: z.enum(REVOCATION_REASONS),
  /** Also disable the account at every provider until a new credential is issued. */
  disable: z.boolean().optional(),
});

/**
 * Audited per-account "sign out everywhere" (incident containment).
 * - CSRF (Atlas SR-05): same-origin JSON only, checked before anything else.
 * - MFA (Atlas SR-04): NOT conditional. The action is unavailable unless privileged MFA enforcement is on AND the caller
 *   holds a recent verified step-up; the flag-gated assertRecentPrivilegedStepUp is deliberately not used here.
 * Every session the account holds is refused from its next request; the audit row is required, in the same transaction.
 */
export async function POST(req: Request) {
  try {
    assertSameOriginJson(req);
    const actor = await requireMoePlatformAdmin();
    if (!isPrivilegedMfaEnforced()) {
      return NextResponse.json({ error: "Unavailable until privileged MFA enforcement is enabled", code: "PRIVILEGED_MFA_REQUIRED" }, { status: 403 });
    }
    if (!hasRecentPrivilegedStepUp(actor)) {
      return NextResponse.json({ error: "Step-up authentication required", code: "PRIVILEGED_STEP_UP_REQUIRED", stepUpUrl: "/auth/step-up" }, { status: 428 });
    }
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
