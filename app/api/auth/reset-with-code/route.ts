import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { isAccountRecoveryEnabled } from "@/lib/serverFlags";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  try {
    if (!isAccountRecoveryEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { adminCode, password } = await req.json();

    if (!adminCode || typeof adminCode !== "string" || !/^\d{6}$/.test(adminCode)) {
      return NextResponse.json({ error: "A 6-digit reset code is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(`reset-code:ip:${ip}`, {
      windowMs: RATE_LIMIT_POLICIES.AUTH.windowMs,
      limit: RATE_LIMIT_POLICIES.AUTH.limit,
      namespace: "auth",
    });
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(ipLimit);
    }

    const record = await prisma.passwordResetToken.findFirst({
      where: { adminCode },
      include: { User: true },
    });

    if (!record) {
      await logAudit({
        action: "auth.password_reset_code.failed",
        traceId,
        details: { reason: "invalid_code" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Invalid or expired reset code" }, { status: 400 });
    }
    if (record.usedAt) {
      await logAudit({
        userId: record.userId,
        action: "auth.password_reset_code.failed",
        resourceType: "PasswordResetToken",
        resourceId: record.id,
        schoolId: record.User?.schoolId ?? null,
        traceId,
        details: { reason: "already_used" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Reset code has already been used" }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      await logAudit({
        userId: record.userId,
        action: "auth.password_reset_code.failed",
        resourceType: "PasswordResetToken",
        resourceId: record.id,
        schoolId: record.User?.schoolId ?? null,
        traceId,
        details: { reason: "expired" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Reset code has expired" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const changedAt = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { hashedPwd: hash, passwordChangedAt: changedAt },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    await logAudit({
      userId: record.userId,
      action: "auth.password_reset_code.completed",
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
  } catch (err: unknown) {
    console.error("[reset-with-code]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
