import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordReset } from "@/lib/email";
import { isAccountRecoveryEnabled } from "@/lib/serverFlags";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";
import { generateTokenPair } from "@/lib/tokens";
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

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalised = email.trim().toLowerCase();

    const ip = getClientIp(req);
    const ipLimit = await checkRateLimit(`forgot:ip:${ip}`, {
      windowMs: RATE_LIMIT_POLICIES.ADMIN.windowMs,
      limit: RATE_LIMIT_POLICIES.ADMIN.limit,
      namespace: "auth",
    });
    const emailLimit = await checkRateLimit(`forgot:email:${normalised}`, {
      windowMs: RATE_LIMIT_POLICIES.AUTH.windowMs,
      limit: RATE_LIMIT_POLICIES.AUTH.limit,
      namespace: "auth",
    });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return rateLimitExceededResponse(!ipLimit.allowed ? ipLimit : emailLimit);
    }

    const user = await prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, email: true, schoolId: true },
    });

    // Always return ok to avoid leaking account existence
    if (!user) {
      await logAudit({
        action: "auth.password_reset.requested",
        traceId,
        details: { accountFound: false },
        ipAddress: ip,
      });
      return NextResponse.json(
        { ok: true, message: "If that email is registered, a reset link has been sent." },
        { headers: getRateLimitHeaders(emailLimit) }
      );
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { token: rawToken, tokenHash } = generateTokenPair();
    const token = await prisma.passwordResetToken.create({
      data: { userId: user.id, expiresAt, tokenHash },
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${rawToken}`;

    await sendPasswordReset({
      to: user.email,
      name: user.name ?? undefined,
      resetUrl,
    });

    await logAudit({
      userId: user.id,
      action: "auth.password_reset.requested",
      resourceType: "PasswordResetToken",
      resourceId: token.id,
      schoolId: user.schoolId ?? null,
      traceId,
      ipAddress: ip,
    });

    return NextResponse.json(
      { ok: true, message: "If that email is registered, a reset link has been sent." },
      { headers: getRateLimitHeaders(emailLimit) }
    );
  } catch (err: any) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
