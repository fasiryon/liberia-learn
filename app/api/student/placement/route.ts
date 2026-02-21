// app/api/student/placement/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student record not found" }, { status: 404 });
    }

    const body = await req.json();

    const {
      band,
      levelLabel,
      estimatedGrade,
      rawScore,
      totalQuestions,
      details,
      questions,
      answers,
    } = body ?? {};

    if (
      !band ||
      typeof levelLabel !== "string" ||
      typeof estimatedGrade !== "number" ||
      typeof rawScore !== "number" ||
      typeof totalQuestions !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid placement payload" },
        { status: 400 }
      );
    }

    const placementData: any = {
      studentId: student.id,
      band,
      levelLabel,
      estimatedGrade,
      rawScore,
      totalQuestions,
      details: details ?? null,
      questions: questions ?? null,
      answers: answers ?? null,
    };

    const placement = await prisma.placementTest.create({
      data: placementData,
    });

    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        currentGrade: estimatedGrade,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        placement,
        currentGrade: updatedStudent.currentGrade,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Placement API error:", err);
    return NextResponse.json(
      { error: "Failed to record placement test" },
      { status: 500 }
    );
  }
}

