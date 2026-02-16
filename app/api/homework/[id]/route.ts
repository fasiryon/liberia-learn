// app/api/homework/[id]/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const homework = await prisma.homework.findFirst({
      where: { id: params.id, Class: { schoolId: user.schoolId } },
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

    const rawSubmission = homework.submissions[0] ?? null;

    // Gate AI feedback behind teacher review
    const submission = rawSubmission
      ? {
          ...rawSubmission,
          aiScore: rawSubmission.aiReviewed ? rawSubmission.aiScore : null,
          aiFeedback: rawSubmission.aiReviewed ? rawSubmission.aiFeedback : null,
        }
      : null;

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
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
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
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
