import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";
import { buildStudentLearningIntelligence } from "@/lib/student/learningIntelligence";
import { getAdaptiveRecommendations } from "@/lib/student/adaptiveRecommendations";
import { generateStudentActions, getActiveStudentAction } from "@/lib/intelligence/actionEngine";
import { getTimetableForStudent } from "@/lib/timetable/timetableService";

export const dynamic = "force-dynamic";

function emptyAdaptivePlan() {
  return {
    generatedAt: new Date().toISOString(),
    smartContinueHref: "/student/lessons",
    smartContinueLabel: "Browse lessons",
    smartContinueReason: "No scheduled, incomplete, or weak-area recommendation is available right now.",
    orderedActions: [],
    signals: {
      scheduledToday: 0,
      incompleteToday: 0,
      weaknessCount: 0,
      recommendationCount: 0,
    },
  };
}

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    // Find student's enrolled classes
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, enrollments: { select: { classId: true } } },
    });

    if (!student) {
      return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
    }

    const classIds = student.enrollments.map((e) => e.classId);
    if (classIds.length === 0) {
      return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
    }

    // Today's date range (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const [scheduledWork, intelligence, adaptiveResult] = await Promise.all([
      prisma.scheduledWork.findMany({
        where: {
          classId: { in: classIds },
          scheduledDate: { gte: startOfDay, lt: endOfDay },
        },
        include: {
          content: {
            select: {
              contentId: true,
              grade: true,
              subject: true,
              contentType: true,
              payload: true,
            },
          },
          progress: {
            where: { studentId: user.id },
            select: { completedAt: true, startedAt: true },
          },
        },
        orderBy: { periodNumber: "asc" },
      }),
      buildStudentLearningIntelligence(user).catch(() => ({
        generatedAt: new Date().toISOString(),
        masteryBySubject: [],
        weaknesses: [],
        recommendedNextActions: [],
      })),
      getAdaptiveRecommendations(student.id, user.schoolId, user.id).catch(() => ({
        recommendation: null,
        masteryAlerts: [],
        contentGap: false,
        pacingSignal: "on_track" as const,
        weakTopicSequence: [],
      })),
    ]);

    // Fire-and-forget: persist adaptive signals as trackable actions
    generateStudentActions(student.id, user.schoolId ?? "", {
      recommendation: adaptiveResult.recommendation,
      masteryAlerts: adaptiveResult.masteryAlerts,
      contentGap: adaptiveResult.contentGap,
      grade: adaptiveResult.recommendation?.grade ?? null,
    }).catch(() => null);

    const activeAction = await getActiveStudentAction(student.id).catch(() => null);
    const timetable = await getTimetableForStudent(student.id, new Date()).catch(() => null);

    const items = scheduledWork.map((sw, index) => {
      const payload = sw.content.payload as any;
      const progress = sw.progress[0];
      let status: "not_started" | "in_progress" | "completed" = "not_started";
      if (progress?.completedAt) status = "completed";
      else if (progress?.startedAt) status = "in_progress";
      const lab = getLessonLabLinks({
        subject: sw.content.subject,
        grade: sw.content.grade,
      })[0] ?? null;

      return {
        id: sw.id,
        contentId: sw.content.contentId,
        title: payload?.title || payload?.topic || `${sw.content.subject} Lesson`,
        subject: sw.content.subject,
        grade: sw.content.grade,
        contentType: sw.content.contentType,
        estimatedDuration: payload?.durationMins || 45,
        periodNumber: sw.periodNumber,
        startTime: sw.startTime,
        endTime: sw.endTime,
        status,
        completedAt: progress?.completedAt || null,
        order: index + 1,
        lessonHref: `/student/lessons/${sw.id}`,
        quizHref: `/student/lessons/${sw.id}#lesson-quiz`,
        lab: lab ? { ...lab, href: `/student/labs/${lab.labId}` } : null,
      };
    });

    const current = items.find((item) => item.status !== "completed") ?? items[0] ?? null;
    const next = current
      ? items.find((item) => item.order > current.order && item.status !== "completed") ?? null
      : null;
    const adaptiveActions = [
      ...items
        .filter((item) => item.status !== "completed")
        .map((item) => ({
          type: item.status === "in_progress" ? "continue_current_lesson" : "scheduled_today",
          label: item.status === "in_progress" ? `Continue ${item.title}` : `Start ${item.title}`,
          reason: `Scheduled today as ${item.periodNumber ? `period ${item.periodNumber}` : `lesson ${item.order}`}.`,
          href: item.lessonHref,
          priority: item.status === "in_progress" ? 110 : 105 - item.order,
          source: "scheduled_work",
        })),
      ...intelligence.recommendedNextActions.map((action) => ({
        ...action,
        source: "learning_intelligence",
      })),
    ]
      .sort((left, right) => right.priority - left.priority)
      .filter(
        (action, index, list) =>
          list.findIndex((item) => item.href === action.href) === index
      )
      .slice(0, 5);
    const smartContinue = adaptiveActions[0] ?? null;

    return NextResponse.json({
      items,
      subjects: Array.from(new Set(items.map((item) => item.subject))),
      completedCount: items.filter((item) => item.status === "completed").length,
      remainingCount: items.filter((item) => item.status !== "completed").length,
      currentItemId: current?.id ?? null,
      nextItemId: next?.id ?? null,
      priority: adaptiveResult.recommendation?.type ?? null,
      recommendation: adaptiveResult.recommendation
        ? {
            type: adaptiveResult.recommendation.type,
            lessonId: adaptiveResult.recommendation.lessonId,
            scheduledWorkId: adaptiveResult.recommendation.scheduledWorkId,
            reason: adaptiveResult.recommendation.reason,
            sourceSignal: adaptiveResult.recommendation.sourceSignal,
            masteryPercent: adaptiveResult.recommendation.masteryPercent,
            confidenceTier: adaptiveResult.recommendation.confidenceTier,
          }
        : null,
      masteryAlerts: adaptiveResult.masteryAlerts,
      contentGap: adaptiveResult.contentGap,
      pacingSignal: adaptiveResult.pacingSignal,
      weakTopicSequence: adaptiveResult.weakTopicSequence,
      activeAction: activeAction
        ? {
            id: activeAction.id,
            actionType: activeAction.actionType,
            reason: activeAction.reason,
            severity: activeAction.severity,
            href: activeAction.href,
            sourceSignal: activeAction.sourceSignal,
          }
        : null,
      adaptivePlan: {
        generatedAt: intelligence.generatedAt,
        smartContinueHref: smartContinue?.href ?? "/student/lessons",
        smartContinueLabel: smartContinue?.label ?? "Browse lessons",
        smartContinueReason:
          smartContinue?.reason ??
          "No scheduled, incomplete, or weak-area recommendation is available right now.",
        orderedActions: adaptiveActions,
        signals: {
          scheduledToday: items.length,
          incompleteToday: items.filter((item) => item.status !== "completed").length,
          weaknessCount: intelligence.weaknesses.length,
          recommendationCount: intelligence.recommendedNextActions.length,
        },
      },
      timetable: timetable ?? null,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
