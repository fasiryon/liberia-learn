import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { generateTeacherAppointment } from "@/lib/canva/templates/teacherAppointment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teacherId } = await req.json();
  if (!teacherId) return NextResponse.json({ error: "teacherId required" }, { status: 400 });

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolId: user.schoolId!, role: "TEACHER" },
    include: { school: { select: { name: true } } },
  });

  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const doc = await generateTeacherAppointment(
    {
      teacherName: teacher.name ?? "Teacher",
      position: "Classroom Teacher",
      schoolName: teacher.school?.name ?? "School",
      startDate: new Date().toLocaleDateString("en-LR"),
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    },
    user.schoolId!,
    teacherId,
    user.id
  );

  return NextResponse.json(doc, { status: 201 });
}
