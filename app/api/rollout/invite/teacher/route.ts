import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateTokenPair } from "@/lib/tokens";
import { sendTeacherInvite } from "@/lib/email";
import { isEnrollmentInvitesEnabled } from "@/lib/serverFlags";
import { checkRateLimit } from "@/lib/rateLimit";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const Schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  schoolId: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`rollout:teacher:ip:${ip}`, { windowMs: 60 * 60 * 1000, max: 20 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const traceId = crypto.randomUUID();
  try {
    if (!isEnrollmentInvitesEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = Schema.parse(body);

    const schoolId =
      user.isPlatformAdmin && parsed.schoolId ? parsed.schoolId : user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const { token: rawToken, tokenHash } = generateTokenPair();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.inviteToken.create({
      data: {
        schoolId,
        email: parsed.email,
        role: "TEACHER",
        tokenType: "ENROLL_TEACHER",
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/onboard/accept?token=${rawToken}`;
    const emailResult = await sendTeacherInvite({
      to: parsed.email,
      name: parsed.name,
      schoolName: school.name ?? "LiberiaLearn",
      inviteUrl,
    });

    await logAudit({
      userId: user.id,
      action: "invite.created",
      resourceType: "InviteToken",
      resourceId: invite.id,
      schoolId,
      traceId,
      details: {
        role: "TEACHER",
        tokenType: "ENROLL_TEACHER",
        emailSent: emailResult.ok,
      },
    });

    return NextResponse.json({
      ok: true,
      token: rawToken,
      inviteUrl,
      expiresAt: invite.expiresAt,
      emailSent: emailResult.ok,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
