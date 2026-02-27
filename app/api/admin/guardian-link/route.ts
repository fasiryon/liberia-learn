import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendGuardianInvite } from "@/lib/email";
import { normalizeToE164 } from "@/lib/phone";
import { isGuardianLinkingEnabled } from "@/lib/serverFlags";
import { generateTokenPair } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isGuardianLinkingEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireRole("ADMIN");

    const links = await prisma.studentGuardian.findMany({
      where: {
        student: {
          user: { schoolId: user.schoolId },
        },
      },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        guardian: { select: { id: true, name: true, email: true, guardianPhone: true, guardianPhoneE164: true, preferredChannel: true, smsOptIn: true } },
      },
      orderBy: { id: "desc" },
    });

    const result = links.map((l) => ({
      id: l.id,
      studentName: l.student.user.name ?? l.student.user.email,
      studentEmail: l.student.user.email,
      guardianName: l.guardian.name ?? l.guardian.email,
      guardianEmail: l.guardian.email,
      guardianPhone: l.guardian.guardianPhone,
      guardianPhoneE164: l.guardian.guardianPhoneE164,
      preferredChannel: l.guardian.preferredChannel,
      smsOptIn: l.guardian.smsOptIn,
      relation: l.relation,
    }));

    return NextResponse.json({ links: result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    if (!isGuardianLinkingEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireRole("ADMIN");
    const body = await req.json();

    const { studentId, guardianEmail, guardianName, relation, guardianPhone, guardianCountryCode, preferredChannel, smsOptIn } = body;

    if (!studentId || !guardianEmail) {
      return NextResponse.json(
        { error: "studentId and guardianEmail are required" },
        { status: 400 }
      );
    }

    // Ensure student belongs to admin's school
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { schoolId: true, name: true } } },
    });

    if (!student || student.user.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Student not found in your school" }, { status: 404 });
    }

    // Upsert guardian user
    const email = guardianEmail.trim().toLowerCase();
    let guardian = await prisma.user.findUnique({ where: { email } });

    if (!guardian) {
      guardian = await prisma.user.create({
        data: {
          email,
          name: guardianName || null,
          role: "GUARDIAN",
          schoolId: user.schoolId,
        },
      });
    } else if (guardian.schoolId && guardian.schoolId !== user.schoolId) {
      return NextResponse.json(
        { error: "Guardian belongs to another school" },
        { status: 403 }
      );
    } else if (!guardian.schoolId && user.schoolId) {
      guardian = await prisma.user.update({
        where: { id: guardian.id },
        data: { schoolId: user.schoolId },
      });
    }

    // Update guardian phone/channel fields if provided
    if (guardianPhone || preferredChannel || smsOptIn !== undefined) {
      const phoneData: Record<string, unknown> = {};
      if (guardianPhone) {
        const cc = guardianCountryCode || "+231";
        phoneData.guardianCountryCode = cc;
        phoneData.guardianPhone = guardianPhone;
        phoneData.guardianPhoneE164 = normalizeToE164(guardianPhone, cc);
      }
      if (preferredChannel && ["EMAIL", "SMS", "BOTH"].includes(preferredChannel)) {
        phoneData.preferredChannel = preferredChannel;
      }
      if (typeof smsOptIn === "boolean") {
        phoneData.smsOptIn = smsOptIn;
      }
      if (Object.keys(phoneData).length > 0) {
        await prisma.user.update({ where: { id: guardian.id }, data: phoneData });
      }
    }

    // Create invite token (7-day expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { token: rawToken, tokenHash } = generateTokenPair();
    const invite = await prisma.inviteToken.create({
      data: {
        email,
        role: "GUARDIAN",
        schoolId: user.schoolId!,
        studentId,
        tokenType: "GUARDIAN_LINK",
        relation: relation || null,
        tokenHash,
        expiresAt,
      },
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${base}/guardian/link?token=${rawToken}`;

    // Fetch school name for email
    const school = user.schoolId
      ? await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })
      : null;

    await sendGuardianInvite({
      to: email,
      guardianName: guardianName || undefined,
      studentName: student.user.name ?? "your student",
      schoolName: school?.name ?? "LiberiaLearn",
      inviteUrl,
    });

    return NextResponse.json({ ok: true, inviteUrl });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
