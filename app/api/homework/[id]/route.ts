// app/api/homework/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
  };
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  const student = await prisma.student.findFirst({
    where: { userId },
  });

  if (!student) {
    return NextResponse.json(
      { error: "Student profile not found" },
      { status: 404 }
    );
  }

  const homework = await prisma.homework.findUnique({
    where: { id: params.id },
    include: {
      Class: {
        include: { School: true },
      },
      submissions: {
        where: { studentId: student.id },
        take: 1,
      },
    },
  });

  if (!homework) {
    return NextResponse.json(
      { error: "Homework not found" },
      { status: 404 }
    );
  }

  const submission = homework.submissions[0] ?? null;

  return NextResponse.json({
    homework: {
      id: homework.id,
      title: homework.title,
      instructions: homework.instructions,
      questions: homework.questions,
      dueAt: homework.dueAt,
      className: homework.Class?.name ?? "",
      schoolName: homework.Class?.School?.name ?? "",
    },
    submission,
  });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  const student = await prisma.student.findFirst({
    where: { userId },
  });

  if (!student) {
    return NextResponse.json(
      { error: "Student profile not found" },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const submission = await prisma.homeworkSubmission.upsert({
    where: {
      homeworkId_studentId: {
        homeworkId: params.id,
        studentId: student.id,
      },
    },
    update: {
      answers: body.answers,
      submittedAt: new Date(),
    },
    create: {
      homeworkId: params.id,
      studentId: student.id,
      answers: body.answers,
    },
  });

  return NextResponse.json({ success: true, submission });
}
