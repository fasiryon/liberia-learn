// app/api/student/homework/[id]/submit/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: { id: string };
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const homeworkId = context.params.id;

    const homework = await prisma.homework.findFirst({
      where: { id: homeworkId, Class: { schoolId: user.schoolId } },
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
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Homework submit error:", err);
    return NextResponse.json(
      { error: "Failed to submit homework" },
      { status: 500 }
    );
  }
}
