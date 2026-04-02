import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateTokenPair } from "@/lib/tokens";
import { sendStudentInvite } from "@/lib/email";
import { isEnrollmentInvitesEnabled } from "@/lib/serverFlags";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const Schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rollout:student:ip:${ip}`, {
    windowMs: RATE_LIMIT_POLICIES.INVITES.windowMs,
    limit: RATE_LIMIT_POLICIES.INVITES.limit,
    namespace: "invite",
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl);
  }

  const traceId = crypto.randomUUID();
  try {
    if (!isEnrollmentInvitesEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = Schema.parse(body);

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    });

    const { token: rawToken, tokenHash } = generateTokenPair();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.inviteToken.create({
      data: {
        schoolId: user.schoolId,
        email: parsed.email,
        role: "STUDENT",
        tokenType: "ENROLL_STUDENT",
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/onboard/accept?token=${rawToken}`;
    const emailResult = await sendStudentInvite({
      to: parsed.email,
      name: parsed.name,
      schoolName: school?.name ?? "LiberiaLearn",
      inviteUrl,
    });

    await logAudit({
      userId: user.id,
      action: "invite.created",
      resourceType: "InviteToken",
      resourceId: invite.id,
      schoolId: user.schoolId,
      traceId,
      details: {
        role: "STUDENT",
        tokenType: "ENROLL_STUDENT",
        emailSent: emailResult.ok,
      },
    });

    return NextResponse.json({
      ok: true,
      token: rawToken,
      inviteUrl,
      expiresAt: invite.expiresAt,
      emailSent: emailResult.ok,
    }, { headers: getRateLimitHeaders(rl) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
