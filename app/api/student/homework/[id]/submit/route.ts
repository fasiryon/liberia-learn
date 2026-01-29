// app/api/student/homework/[id]/submit/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    email?: string | null;
    name?: string | null;
  };
};

type RouteContext = {
  params: { id: string };
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const rawSession = await getServerSession(authOptions);
    const session = rawSession as AppSession | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can submit homework" },
        { status: 403 }
      );
    }

    const userId = session.user.id as string;
    const homeworkId = context.params.id;

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
      where: { id: homeworkId },
    });

    if (!homework) {
      return NextResponse.json(
        { error: "Homework not found" },
        { status: 404 }
      );
    }

    const questions = Array.isArray(homework.questions)
      ? (homework.questions as any[])
      : [];

    const formData = await req.formData();
    const answers: string[] = questions.map((_: any, index: number) => {
      const value = formData.get(`answer-${index}`);
      return typeof value === "string" ? value : "";
    });

    // Upsert submission for this student + homework
    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: student.id,
        },
      },
      create: {
        homeworkId,
        studentId: student.id,
        answers,
        submittedAt: new Date(),
      },
      update: {
        answers,
        submittedAt: new Date(),
      },
    });

    // After submit, send them back to the same homework page
    return NextResponse.redirect(
      new URL(`/assignments/${homeworkId}`, req.url)
    );
  } catch (err) {
    console.error("Homework submit error:", err);
    return NextResponse.json(
      { error: "Failed to submit homework" },
      { status: 500 }
    );
  }
}

