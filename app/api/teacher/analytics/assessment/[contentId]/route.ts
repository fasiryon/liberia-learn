// route-policy: auth=session; scope=record; authority=class-teacher-subject-coteacher-or-school-admin; rationale=assessment analytics for one content item: an ADMIN reads its own school's attempts; a teacher reads only attempts of classes where lib/authz/classAuthority grants class.read.learning for the content's subject (class teacher, or a co-teacher assigned that subject); attempts with no class are never in a teacher view; a missing viewer school or no class basis is refused before any attempt query (AT-GRADE-01 batch 2a)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { authorizeClassAccess } from "@/lib/authz/classAuthority";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    // A missing school would otherwise drop the school predicate (Prisma ignores undefined): refuse first.
    if (!user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, title: true, subject: true, grade: true },
    });
    if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ADMIN: school-scoped oversight. TEACHER: only the classes the class-authority service grants for this subject.
    let scope: { schoolId: string; classId?: { in: string[] } } = { schoolId: user.schoolId };
    if (user.role !== "ADMIN") {
      const [owned, assigned] = await Promise.all([
        prisma.class.findMany({ where: { schoolId: user.schoolId, teacherId: user.id }, select: { id: true } }),
        prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: user.id }, select: { classId: true } }),
      ]);
      const candidates = Array.from(new Set([...owned.map((c) => c.id), ...assigned.map((a) => a.classId)]));
      const authorized: string[] = [];
      for (const classId of candidates) {
        if ((await authorizeClassAccess(user, { classId, subject: lesson.subject, fn: "class.read.learning" })).allowed) authorized.push(classId);
      }
      if (authorized.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      scope = { schoolId: user.schoolId, classId: { in: authorized } };
    }

    // Get all attempt details for this content
    const details = await prisma.assessmentAttemptDetail.findMany({
      where: {
        attempt: {
          metadata: {
            path: ["contentId"],
            equals: params.contentId,
          },
          ...scope,
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
        ...scope,
      },
    });

    const avgScoreAgg = await prisma.assessmentAttempt.aggregate({
      where: {
        metadata: {
          path: ["contentId"],
          equals: params.contentId,
        },
        ...scope,
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
