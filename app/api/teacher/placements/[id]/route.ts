import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlacementReviewStatus } from "@/lib/placement";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { id } = await params;
    const placement = await prisma.placementTest.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                schoolId: true,
              },
            },
          },
        },
      },
    });

    if (!placement) {
      return NextResponse.json({ error: "Placement not found" }, { status: 404 });
    }

    if (placement.student.user.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const answers = Array.isArray(placement.answers) ? (placement.answers as any[]) : [];
    const totalTimeSeconds = answers.reduce(
      (sum, answer) => sum + (typeof answer?.timeSpent === "number" ? answer.timeSpent : 0),
      0
    );

    return NextResponse.json({
      placement: {
        id: placement.id,
        createdAt: placement.createdAt.toISOString(),
        band: placement.band,
        levelLabel: placement.levelLabel,
        estimatedGrade: placement.estimatedGrade,
        rawScore: placement.rawScore,
        totalQuestions: placement.totalQuestions,
        details: placement.details,
        questions: placement.questions,
        answers: placement.answers,
        aiAnalysis: placement.aiAnalysis,
        teacherDecision: placement.teacherDecision,
        teacherGrade: placement.teacherGrade,
        teacherReason: placement.teacherReason,
        reviewedAt: placement.reviewedAt?.toISOString() ?? null,
        status: getPlacementReviewStatus(placement.teacherDecision),
        student: {
          id: placement.student.id,
          name: placement.student.user.name ?? placement.student.user.email ?? "Student",
          currentGrade: placement.student.currentGrade,
          timeTakenSeconds: totalTimeSeconds,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
