import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendCredentialSms } from "@/lib/credentials";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  checkRateLimit,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";

const Schema = z.object({
  userId: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/),
});

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const rateLimit = await checkRateLimit(`credential-sms:${admin.id}`, {
      windowMs: RATE_LIMIT_POLICIES.INVITES.windowMs,
      limit: RATE_LIMIT_POLICIES.INVITES.limit,
      namespace: "credential-sms",
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    if (!admin.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id: parsed.data.userId, schoolId: admin.schoolId, role: { in: ["STUDENT", "TEACHER"] } },
      select: {
        id: true,
        name: true,
        role: true,
        loginId: true,
        email: true,
        guardianPhoneE164: true,
        school: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.guardianPhoneE164) {
      return NextResponse.json({ error: "No phone number on file. Use Print instead." }, { status: 400 });
    }

    const roleLabel = user.role === "TEACHER" ? "Teacher" : "Student";
    const result = await sendCredentialSms({
      to: user.guardianPhoneE164,
      schoolName: user.school?.name ?? "LiberiaLearn",
      name: user.name ?? user.email ?? roleLabel,
      loginId: user.loginId ?? user.email ?? user.id,
      pin: parsed.data.pin,
      role: roleLabel,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "SMS failed" }, { status: 502 });
    }

    await logAudit({
      userId: admin.id,
      schoolId: admin.schoolId,
      action: "admin.credentials.sms_sent",
      resourceType: "user",
      resourceId: user.id,
      details: {
        role: user.role,
        attempts: result.attempts,
      },
    });

    return NextResponse.json({ ok: true, phone: user.guardianPhoneE164 });
  } catch (err) {
    return handleApiError(err, { route: "/api/admin/credentials/send", method: "POST" });
  }
}

