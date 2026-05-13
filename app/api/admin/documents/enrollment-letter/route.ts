import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { generateEnrollmentLetter } from "@/lib/canva/templates/enrollmentLetter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  // studentId here is User.id
  const studentUser = await prisma.user.findFirst({
    where: { id: studentId, schoolId: user.schoolId! },
    include: {
      student: {
        include: {
          enrollments: {
            include: { Class: { select: { gradeLevel: true, name: true } } },
            take: 1,
          },
          guardians: {
            include: { guardian: { select: { name: true } } },
            take: 1,
          },
        },
      },
      school: { select: { name: true } },
    },
  });

  if (!studentUser) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const grade = studentUser.student?.enrollments?.[0]?.Class?.gradeLevel
    ? `Grade ${studentUser.student.enrollments[0].Class.gradeLevel}`
    : "Not specified";
  const guardianName =
    studentUser.student?.guardians?.[0]?.guardian?.name ?? "Parent/Guardian";
  const schoolName = studentUser.school?.name ?? "School";

  const doc = await generateEnrollmentLetter(
    {
      studentName: studentUser.name ?? "Student",
      guardianName,
      grade,
      schoolName,
      enrollmentDate: new Date().toLocaleDateString("en-LR"),
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    },
    user.schoolId!,
    studentId,
    user.id
  );

  return NextResponse.json(doc, { status: 201 });
}
