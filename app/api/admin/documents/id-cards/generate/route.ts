import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { generateStudentIdCard } from "@/lib/canva/templates/studentIdCard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { classId } = await req.json();
  if (!classId) return NextResponse.json({ error: "classId required" }, { status: 400 });

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId: user.schoolId! },
    include: {
      School: { select: { name: true } },
      enrollments: {
        include: {
          Student: {
            include: { user: { select: { id: true, name: true, loginId: true } } },
          },
        },
      },
    },
  });

  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const jobs = cls.enrollments.map((enrollment) => {
    const studentUser = enrollment.Student.user;
    const grade = cls.gradeLevel ? `Grade ${cls.gradeLevel}` : cls.name;
    return generateStudentIdCard(
      {
        studentName: studentUser.name ?? "Student",
        studentNumber: studentUser.loginId ?? enrollment.Student.id.slice(0, 8).toUpperCase(),
        grade,
        schoolName: cls.School.name,
        academicYear:
          new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
      },
      user.schoolId!,
      studentUser.id,
      user.id
    );
  });

  const docs = await Promise.all(jobs);
  return NextResponse.json({ generated: docs.length, docs }, { status: 201 });
}
