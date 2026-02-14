import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendGuardianInvite } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");

    const links = await prisma.studentGuardian.findMany({
      where: {
        student: {
          user: { schoolId: user.schoolId },
        },
      },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        guardian: { select: { id: true, name: true, email: true } },
      },
      orderBy: { id: "desc" },
    });

    const result = links.map((l) => ({
      id: l.id,
      studentName: l.student.user.name ?? l.student.user.email,
      studentEmail: l.student.user.email,
      guardianName: l.guardian.name ?? l.guardian.email,
      guardianEmail: l.guardian.email,
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
    const user = await requireRole("ADMIN");
    const body = await req.json();

    const { studentId, guardianEmail, guardianName, relation } = body;

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
    }

    // Upsert StudentGuardian link
    await prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: { studentId, guardianId: guardian.id },
      },
      create: {
        studentId,
        guardianId: guardian.id,
        relation: relation || null,
      },
      update: {
        relation: relation || undefined,
      },
    });

    // Create invite token (7-day expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.inviteToken.create({
      data: {
        email,
        role: "GUARDIAN",
        schoolId: user.schoolId!,
        expiresAt,
      },
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${base}/invite?token=${invite.token}`;

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
