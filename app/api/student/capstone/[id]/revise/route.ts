import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const project = await (prisma as any).capstoneProject.findUnique({
    where: { id: params.id },
    select: { studentId: true, status: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.studentId !== student.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (project.status !== "REJECTED") {
    return NextResponse.json({ error: "Only REJECTED projects can be revised" }, { status: 400 });
  }

  const updated = await (prisma as any).capstoneProject.update({
    where: { id: params.id },
    data: { status: "DRAFT", submittedAt: null, reviewedAt: null, teacherFeedback: null },
  });

  return NextResponse.json(updated);
}
