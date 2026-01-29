// app/api/homework/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { homeworkId, studentId, answers } = body ?? {};

    if (!homeworkId || !studentId || !answers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Answers must be an array" },
        { status: 400 }
      );
    }

    // Load homework + class + enrollments to ensure student is allowed
    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        Class: {
          include: {
            enrollments: true,
          },
        },
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: "Homework not found" },
        { status: 404 }
      );
    }

    const isEnrolled = homework.Class.enrollments.some(
      (enrollment) => enrollment.studentId === studentId
    );

    if (!isEnrolled) {
      return NextResponse.json(
        { error: "You are not enrolled in this class" },
        { status: 403 }
      );
    }

    // Check if already submitted
    const existing = await prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already submitted" },
        { status: 400 }
      );
    }

    // Create submission
    const submission = await prisma.homeworkSubmission.create({
      data: {
        homeworkId,
        studentId,
        answers,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, submission });
  } catch (error: any) {
    console.error("Submit homework error:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to submit homework. Please try again later.",
      },
      { status: 500 }
    );
  }
}
