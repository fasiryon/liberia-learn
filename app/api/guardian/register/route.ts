import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendGuardianWelcome } from "@/lib/email";
import { findInviteByToken } from "@/lib/inviteTokens";
import { isValidPin } from "@/lib/login-identifiers";

const Schema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1),
  pin: z.string().min(4).max(6),
  confirmPin: z.string().min(4).max(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please fill in all fields." }, { status: 400 });
    }

    const { token, fullName, pin, confirmPin } = parsed.data;
    if (!isValidPin(pin) || pin !== confirmPin) {
      return NextResponse.json({ error: "Use the same 4-6 digit PIN in both boxes." }, { status: 400 });
    }

    const invite = await findInviteByToken(token);
    if (!invite || invite.tokenType !== "GUARDIAN_LINK" || invite.usedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This link has expired. Please contact your child's school." }, { status: 400 });
    }

    const student = invite.studentId
      ? await prisma.student.findUnique({
          where: { id: invite.studentId },
          select: { id: true, user: { select: { schoolId: true } } },
        })
      : null;

    if (!student || student.user.schoolId !== invite.schoolId) {
      return NextResponse.json({ error: "This link has expired. Please contact your child's school." }, { status: 400 });
    }

    const existingGuardian = invite.email
      ? await prisma.user.findUnique({ where: { email: invite.email } })
      : null;

    const phone = existingGuardian?.guardianPhoneE164;
    if (!phone) {
      return NextResponse.json({ error: "This link has expired. Please contact your child's school." }, { status: 400 });
    }

    const hashedPwd = await bcrypt.hash(pin, 10);
    const email = invite.email ?? `${phone.replace(/\D/g, "")}@guardian.local`;

    await prisma.$transaction(async (tx) => {
      const guardian = existingGuardian
        ? await tx.user.update({
            where: { id: existingGuardian.id },
            data: {
              name: fullName.trim(),
              email,
              role: "GUARDIAN",
              schoolId: invite.schoolId,
              hashedPwd,
              passwordChangedAt: new Date(),
              smsOptIn: true,
              preferredChannel: "SMS",
            },
          })
        : await tx.user.create({
            data: {
              email,
              name: fullName.trim(),
              role: "GUARDIAN",
              schoolId: invite.schoolId,
              hashedPwd,
              guardianCountryCode: "+231",
              guardianPhone: phone,
              guardianPhoneE164: phone,
              smsOptIn: true,
              preferredChannel: "SMS",
              passwordChangedAt: new Date(),
            },
          });

      await tx.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
        create: { studentId: student.id, guardianId: guardian.id, relation: invite.relation ?? null },
        update: { relation: invite.relation ?? undefined },
      });

      await tx.guardianConsent.upsert({
        where: {
          GuardianConsent_schoolId_studentId_guardianId_key: {
            schoolId: invite.schoolId,
            studentId: student.id,
            guardianId: guardian.id,
          },
        },
        create: {
          schoolId: invite.schoolId,
          studentId: student.id,
          guardianId: guardian.id,
          smsOptIn: true,
          source: "guardian_register_sms",
        },
        update: {
          smsOptIn: true,
          optedOutAt: null,
          source: "guardian_register_sms",
        },
      });

      await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    });

    if (invite.email && !invite.email.endsWith("@guardian.local")) {
      const school = await prisma.school.findUnique({
        where: { id: invite.schoolId },
        select: { name: true },
      }).catch(() => null);
      await sendGuardianWelcome({
        to: invite.email,
        guardianName: fullName.trim(),
        schoolName: school?.name ?? "LiberiaLearn",
        dashboardUrl: `${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/guardian/dashboard`,
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, redirectTo: "/login?message=Account%20created.%20Log%20in%20with%20your%20phone%20and%20PIN." });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "We could not create your account. Please try again." }, { status });
  }
}

