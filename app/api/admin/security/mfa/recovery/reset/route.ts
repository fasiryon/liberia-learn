import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { requirePlatformAdmin, requirePrivilegedStepUp } from "@/lib/auth";
import { isPrivilegedAccount } from "@/lib/auth/privilegedIdentity";
import { resetAuth0Mfa } from "@/lib/auth/auth0Management";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(12).max(500),
});

export async function POST(req: Request) {
  try {
    const actor = await requirePlatformAdmin();
    await requirePrivilegedStepUp(actor);

    const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "targetUserId and a recovery reason of at least 12 characters are required" },
        { status: 400 }
      );
    }

    const limit = await checkRateLimit(`mfa-recovery:${actor.id}`, {
      namespace: "auth",
      windowMs: 60 * 60 * 1000,
      limit: 3,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many MFA recovery attempts", retryAfter: limit.retryAfter },
        { status: 429, headers: getRateLimitHeaders(limit) }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.targetUserId },
      select: {
        id: true,
        role: true,
        schoolId: true,
        isPlatformAdmin: true,
        privilegedIdentity: {
          select: { id: true, provider: true, providerSubject: true },
        },
      },
    });
    if (!target || !isPrivilegedAccount(target) || !target.privilegedIdentity?.providerSubject) {
      return NextResponse.json({ error: "Privileged Auth0 identity not found" }, { status: 404 });
    }

    await logAuditRequired({
      userId: actor.id,
      action: "auth.privileged_mfa.recovery_reset_requested",
      resourceType: "privileged_identity",
      resourceId: target.privilegedIdentity.id,
      schoolId: target.schoolId,
      details: {
        targetUserId: target.id,
        reason: parsed.data.reason,
        provider: target.privilegedIdentity.provider,
      },
    });

    await resetAuth0Mfa(target.privilegedIdentity.providerSubject);

    const changedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.privilegedIdentity.update({
        where: { id: target.privilegedIdentity!.id },
        data: {
          securityVersion: { increment: 1 },
          mfaEnrolledAt: null,
          mfaChangedAt: changedAt,
          recoveryResetAt: changedAt,
          lastMfaAt: null,
          breakGlassUntil: null,
          breakGlassReason: null,
        },
      });
      await tx.privilegedSessionAssurance.updateMany({
        where: { identityId: updated.id, revokedAt: null },
        data: { revokedAt: changedAt },
      });
      await logAuditRequired(
        {
          userId: actor.id,
          action: "auth.privileged_mfa.recovery_reset_completed",
          resourceType: "privileged_identity",
          resourceId: updated.id,
          schoolId: target.schoolId,
          details: {
            targetUserId: target.id,
            reason: parsed.data.reason,
            securityVersion: updated.securityVersion,
          },
        },
        tx
      );
    });

    return NextResponse.json({
      ok: true,
      targetUserId: target.id,
      reEnrollmentRequired: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "MFA recovery reset failed",
        ...(error?.code ? { code: error.code } : {}),
        ...(error?.stepUpUrl ? { stepUpUrl: error.stepUpUrl } : {}),
      },
      { status: error?.status ?? 500 }
    );
  }
}
