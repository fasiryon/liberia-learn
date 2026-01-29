import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-config";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const homeworkId = ctx?.params?.id;
    if (!homeworkId) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const hw = await prisma.homework.findUnique({
      where: { id: homeworkId },
      select: {
        id: true,
        classId: true,
        title: true,
        description: true,
        dueAt: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        subject: true,
        Class: { select: { id: true, name: true, subject: true, teacherId: true } },
      },
    });

    if (!hw) return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    if (!hw.Class) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const isStudent = user.role === "STUDENT";
    const isTeacher = user.role === "TEACHER";
    const isAdmin = user.role === "ADMIN";

    if (!isStudent && !isTeacher && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // TEACHER: must own the class
    if (isTeacher) {
      if (hw.Class.teacherId !== user.id) {
        return NextResponse.json({ error: "Not your class" }, { status: 403 });
      }
      return NextResponse.json({ homework: hw });
    }

    // ADMIN: allowed
    if (isAdmin) {
      return NextResponse.json({ homework: hw });
    }

    // STUDENT: must have a Student profile
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    // Enrollment enforcement (only if Enrollment exists in your schema)
    const enrolled = await prisma.enrollment.findFirst({
      where: { classId: hw.classId, studentId: student.id },
      select: { id: true },
    });
    if (!enrolled) return NextResponse.json({ error: "Not enrolled in this class" }, { status: 403 });

    return NextResponse.json({ homework: hw });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}