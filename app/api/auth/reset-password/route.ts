// route-policy: auth=public; scope=none; authority=reset-token; rationale=unauthenticated by design; the reset record is found by token hash or by the legacy raw-token column; the target account comes from the record; single use is an atomic conditional claim (unused and unexpired) in the same transaction as the password change and credential version advance, which revokes every earlier session; IP rate-limited; completion audit is best effort; refused on any deployed Preview/staging before authority or data work (PREVIEW_IDENTITY_FROZEN)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { advanceSecurityStamp, ConcurrentCredentialChangeError } from "@/lib/auth/sessionRevocation";
import bcrypt from "bcryptjs";
import { isAccountRecoveryEnabled } from "@/lib/serverFlags";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { hashToken } from "@/lib/tokens";
import crypto from "crypto";
import { previewIdentityFrozen } from "@/lib/preview/identityFreeze";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  const frozen = previewIdentityFrozen();
  if (frozen) return frozen;
  const traceId = crypto.randomUUID();
  try {
    if (!isAccountRecoveryEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(`reset:ip:${ip}`, {
      windowMs: RATE_LIMIT_POLICIES.AUTH.windowMs,
      limit: RATE_LIMIT_POLICIES.AUTH.limit,
      namespace: "auth",
    });
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(ipLimit);
    }

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findFirst({
      where: { OR: [{ tokenHash }, { token }] },
      include: { User: true },
    });

    if (!record) {
      await logAudit({
        action: "auth.password_reset.failed",
        traceId,
        details: { reason: "invalid_token" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    if (record.usedAt) {
      await logAudit({
        userId: record.userId,
        action: "auth.password_reset.failed",
        resourceType: "PasswordResetToken",
        resourceId: record.id,
        schoolId: record.User?.schoolId ?? null,
        traceId,
        details: { reason: "already_used" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Token has already been used" }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      await logAudit({
        userId: record.userId,
        action: "auth.password_reset.failed",
        resourceType: "PasswordResetToken",
        resourceId: record.id,
        schoolId: record.User?.schoolId ?? null,
        traceId,
        details: { reason: "expired" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const changedAt = new Date();

    // Single use, atomically (Atlas R1: two concurrent redemptions returned 200/200): claim the record only if it is still
    // unused and unexpired; a caller that loses the claim changes nothing. The password change and the credential
    // version advance (which revokes every earlier session) commit in the same transaction as the claim.
    const redeemed = await prisma.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: changedAt } },
        data: { usedAt: changedAt },
      });
      if (claim.count !== 1) return false;
      await tx.user.update({ where: { id: record.userId }, data: { hashedPwd: hash } });
      await advanceSecurityStamp(tx, record.userId, changedAt);
      await tx.session.deleteMany({ where: { userId: record.userId } });
      return true;
    });
    if (!redeemed) {
      return NextResponse.json({ error: "Token has already been used" }, { status: 400 });
    }

    await logAudit({
      userId: record.userId,
      action: "auth.password_reset.completed",
      resourceType: "PasswordResetToken",
      resourceId: record.id,
      schoolId: record.User?.schoolId ?? null,
      traceId,
      ipAddress: ip,
    });

    return NextResponse.json(
      { ok: true, message: "Password has been reset. You can now sign in." },
      { headers: getRateLimitHeaders(ipLimit) }
    );
  } catch (err: any) {
    if (err instanceof ConcurrentCredentialChangeError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
