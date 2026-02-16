// app/api/homework/review/route.ts
// Teacher triggers AI grading + marks submission as reviewed.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HomeworkGrader } from "@/lib/ai/homework-grader";

const bodySchema = z.object({
  submissionId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const teacher = await requireRole("TEACHER", "ADMIN");

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 }
      );
    }

    const { submissionId } = parsed.data;

    const submission = await prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: {
        Student: {
          include: { user: { select: { schoolId: true } } },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // School isolation check
    if (submission.Student.user.schoolId !== teacher.schoolId) {
      return NextResponse.json(
        { error: "Forbidden — submission belongs to another school" },
        { status: 403 }
      );
    }

    // If already AI-graded, just flip the reviewed flag
    if (submission.aiScore !== null && submission.aiFeedback !== null) {
      const updated = await prisma.homeworkSubmission.update({
        where: { id: submissionId },
        data: { aiReviewed: true },
      });
      return NextResponse.json({ ok: true, submission: updated });
    }

    // Not yet graded — invoke the AI grader
    await HomeworkGrader.gradeSubmission(submissionId);

    // Mark reviewed in a separate update (grader doesn't set aiReviewed)
    const updated = await prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: { aiReviewed: true },
    });

    return NextResponse.json({ ok: true, submission: updated });
  } catch (err: any) {
    console.error("Homework review error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to review submission" },
      { status: err?.status ?? 500 }
    );
  }
}
