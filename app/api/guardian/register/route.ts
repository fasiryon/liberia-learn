// route-policy: auth=public; scope=none; authority=guardian-invite-token; rationale=unauthenticated by design; a GUARDIAN_LINK invite can set a same-school non-platform GUARDIAN's PIN only through a conditional write in the claim transaction; no role or school rebinding; single-use claim and credential version advance commit atomically; refused on any deployed Preview/staging before authority or data work (PREVIEW_IDENTITY_FROZEN)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { advanceSecurityStamp } from "@/lib/auth/sessionRevocation";
import { sendGuardianWelcome } from "@/lib/email";
import { findInviteByToken } from "@/lib/inviteTokens";
import { isValidPin } from "@/lib/login-identifiers";
import { previewIdentityFrozen } from "@/lib/preview/identityFreeze";

const Schema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1),
  pin: z.string().min(4).max(6),
  confirmPin: z.string().min(4).max(6),
});

export async function POST(req: Request) {
  const frozen = previewIdentityFrozen();
  if (frozen) return frozen;
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

    if (!existingGuardian || !existingGuardian.guardianPhoneE164) {
      return NextResponse.json({ error: "This link has expired. Please contact your child's school." }, { status: 400 });
    }
    const phone = existingGuardian.guardianPhoneE164;

    const hashedPwd = await bcrypt.hash(pin, 10);
    await prisma.$transaction(async (tx) => {
      // The phone precondition already requires an existing account. Check its CURRENT authority in
      // the write itself: a concurrent role/school/platform change must not turn an invite into a reset.
      const guardian = existingGuardian;
      const updated = await tx.user.updateMany({
        where: { id: guardian.id, email: guardian.email, role: "GUARDIAN", schoolId: invite.schoolId,
          isPlatformAdmin: false, guardianPhoneE164: phone },
        data: { name: fullName.trim(), hashedPwd, smsOptIn: true, preferredChannel: "SMS" },
      });
      if (updated.count !== 1) {
        throw Object.assign(new Error("This link has expired. Please contact your child's school."), { status: 400 });
      }

      // An existing account's credential and identity changed: advance its version (revokes its earlier sessions).
      await advanceSecurityStamp(tx, guardian.id);

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

      // Single use, atomically: only the caller that claims a still-unused, unexpired invite commits; the other rolls back.
      const claim = await tx.inviteToken.updateMany({ where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claim.count !== 1) throw Object.assign(new Error("This invite has already been used."), { status: 400 });
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

