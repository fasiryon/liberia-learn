import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (project.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT projects can be edited" }, { status: 400 });
  }

  const body = await req.json();
  const { title, description, skills, fileUrls } = body as {
    title?: string;
    description?: string;
    skills?: string[];
    fileUrls?: string[];
  };

  const updated = await (prisma as any).capstoneProject.update({
    where: { id: params.id },
    data: {
      ...(title ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(fileUrls !== undefined ? { fileUrls } : {}),
    },
  });

  return NextResponse.json(updated);
}
