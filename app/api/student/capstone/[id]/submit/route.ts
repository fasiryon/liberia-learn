import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const project = await (prisma as any).capstoneProject.findUnique({
    where: { id: params.id },
    select: { studentId: true, status: true, title: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.studentId !== student.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (project.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT projects can be submitted" }, { status: 400 });
  }

  const updated = await (prisma as any).capstoneProject.update({
    where: { id: params.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  // Notify the teacher if assigned, otherwise notify all teachers at school
  const enrollment = await prisma.enrollment.findFirst({
    where: { Student: { userId: user.id } },
    include: { Class: { select: { teacherId: true } } },
  });
  const teacherUserId = enrollment?.Class?.teacherId;
  if (teacherUserId) {
    sendPushToUser(teacherUserId, {
      title: "Capstone Submitted",
      body: `${user.name ?? "A student"} submitted their capstone: ${project.title}`,
      url: "/teacher/capstone",
    }).catch(() => null);
  }

  return NextResponse.json(updated);
}
