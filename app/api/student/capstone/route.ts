import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, currentGrade: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  if (!student.currentGrade || student.currentGrade < 10) {
    return NextResponse.json({ error: "Capstone is only available to Grade 10 and above" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, skills, fileUrls } = body as {
    title: string;
    description?: string;
    skills?: string[];
    fileUrls?: string[];
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const project = await (prisma as any).capstoneProject.create({
    data: {
      studentId: student.id,
      title: title.trim(),
      description: description ?? null,
      skills: skills ?? null,
      fileUrls: fileUrls ?? null,
      status: "DRAFT",
    },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function GET() {
  const user = await requireUser();
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, currentGrade: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  if (!student.currentGrade || student.currentGrade < 10) {
    return NextResponse.json({ error: "Capstone is only available to Grade 10 and above" }, { status: 403 });
  }

  const projects = await (prisma as any).capstoneProject.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}
