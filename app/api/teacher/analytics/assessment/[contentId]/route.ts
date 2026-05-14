import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, title: true, subject: true, grade: true },
    });
    if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get all attempt details for this content
    const details = await prisma.assessmentAttemptDetail.findMany({
      where: {
        attempt: {
          metadata: {
            path: ["contentId"],
            equals: params.contentId,
          },
          schoolId: user.role === "ADMIN" ? user.schoolId ?? undefined : user.schoolId ?? undefined,
        },
      },
      orderBy: [{ questionIdx: "asc" }],
    });

    // Also count total attempts for this content
    const totalAttempts = await prisma.assessmentAttempt.count({
      where: {
        metadata: {
          path: ["contentId"],
          equals: params.contentId,
        },
        schoolId: user.schoolId ?? undefined,
      },
    });

    const avgScoreAgg = await prisma.assessmentAttempt.aggregate({
      where: {
        metadata: {
          path: ["contentId"],
          equals: params.contentId,
        },
        schoolId: user.schoolId ?? undefined,
      },
      _avg: { score: true },
    });

    // Group by questionIdx
    const questionMap = new Map<
      number,
      {
        idx: number;
        text: string;
        correct: number;
        total: number;
        wrongAnswers: Map<string, number>;
      }
    >();

    for (const detail of details) {
      const existing = questionMap.get(detail.questionIdx) ?? {
        idx: detail.questionIdx,
        text: detail.questionText,
        correct: 0,
        total: 0,
        wrongAnswers: new Map<string, number>(),
      };
      existing.total += 1;
      if (detail.isCorrect) {
        existing.correct += 1;
      } else {
        existing.wrongAnswers.set(
          detail.selectedAnswer,
          (existing.wrongAnswers.get(detail.selectedAnswer) ?? 0) + 1
        );
      }
      questionMap.set(detail.questionIdx, existing);
    }

    const questions = Array.from(questionMap.values())
      .map((q) => {
        const correctRate = q.total > 0 ? q.correct / q.total : null;
        let mostCommonWrongAnswer: string | null = null;
        let maxCount = 0;
        for (const [answer, count] of q.wrongAnswers) {
          if (count > maxCount) {
            maxCount = count;
            mostCommonWrongAnswer = answer;
          }
        }
        return {
          idx: q.idx,
          text: q.text.length > 120 ? q.text.slice(0, 117) + "..." : q.text,
          correctRate,
          totalAnswered: q.total,
          mostCommonWrongAnswer,
        };
      })
      .sort((a, b) => (a.correctRate ?? 1) - (b.correctRate ?? 1)); // hardest first

    const hardestQuestion = questions[0] ?? null;

    return NextResponse.json({
      lesson: {
        contentId: lesson.contentId,
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
      },
      totalAttempts,
      avgScore: avgScoreAgg._avg.score != null ? Math.round(avgScoreAgg._avg.score * 100) : null,
      hardestQuestion: hardestQuestion
        ? { idx: hardestQuestion.idx, text: hardestQuestion.text, correctRate: hardestQuestion.correctRate }
        : null,
      questions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load analytics" }, { status: error?.status ?? 500 });
  }
}
