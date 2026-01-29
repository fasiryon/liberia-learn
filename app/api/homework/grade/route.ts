// app/api/homework/grade/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { submissionId, teacherScore, teacherNotes } = body;

    if (!submissionId || typeof teacherScore !== "number") {
      return NextResponse.json(
        { error: "submissionId and numeric teacherScore are required" },
        { status: 400 }
      );
    }

    if (teacherScore < 0 || teacherScore > 100) {
      return NextResponse.json(
        { error: "teacherScore must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Update submission + include homework for classId
    const updated = await prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        teacherScore,
        teacherNotes,
      },
      include: {
        Homework: true,
      },
    });

    const classId = updated.Homework.classId;
    const studentId = updated.studentId;

    // Recompute Grade (per class per student)
    const gradedSubs = await prisma.homeworkSubmission.findMany({
      where: {
        studentId,
        teacherScore: { not: null },
        Homework: { classId },
      },
      select: { teacherScore: true },
    });

    if (gradedSubs.length > 0) {
      const avg =
        gradedSubs.reduce(
          (sum, s) => sum + (s.teacherScore ?? 0),
          0
        ) / gradedSubs.length;

      const percent = Math.round(avg);

      let letter = "F";
      if (percent >= 90) letter = "A";
      else if (percent >= 80) letter = "B";
      else if (percent >= 70) letter = "C";
      else if (percent >= 60) letter = "D";

      const existing = await prisma.grade.findFirst({
        where: { classId, studentId },
      });

      if (existing) {
        await prisma.grade.update({
          where: { id: existing.id },
          data: { percent, letter },
        });
      } else {
        await prisma.grade.create({
          data: { classId, studentId, percent, letter },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Grade homework error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save grade" },
      { status: 500 }
    );
  }
}
