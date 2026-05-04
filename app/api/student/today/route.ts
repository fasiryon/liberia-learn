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

type TodayWorkStatus = "not_started" | "in_progress" | "completed";

type TodayWorkItem = {
  id: string;
  classId: string;
  contentId: string;
  title: string;
  subject: string;
  grade: number;
  contentType: string;
  estimatedDuration: number;
  periodNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  status: TodayWorkStatus;
  completedAt: Date | null;
  order: number;
  lessonHref: string;
  quizHref: string;
  lab: { labId: string; label: string; href: string } | null;
  assignment: {
    id: string;
    title: string;
    href: string;
    dueAt: string | null;
    status: "open" | "submitted";
  } | null;
};

function parsePeriodNumber(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function minutesFromTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hours, minutes = "0"] = value.split(":");
  const h = Number(hours);
  const m = Number(minutes);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function timeRange(startTime: string | null, endTime: string | null) {
  if (startTime && endTime) return `${startTime}-${endTime}`;
  return startTime ?? endTime ?? null;
}

function resolveSlotStatus(params: {
  status: TodayWorkStatus | null;
  startTime: string | null;
  endTime: string | null;
  index: number;
  firstOpenIndex: number;
  nowMinutes: number;
}) {
  if (params.status === "completed") return "completed";

  const start = minutesFromTime(params.startTime);
  const end = minutesFromTime(params.endTime);
  if (start != null && end != null) {
    if (params.nowMinutes >= start && params.nowMinutes <= end) return "current";
    if (params.nowMinutes < start) return "upcoming";
    return "missed";
  }

  return params.index === params.firstOpenIndex ? "current" : "upcoming";
}

function primaryActionFor(params: {
  scheduleStatus: string;
  workStatus: TodayWorkStatus | null;
  lessonHref: string | null;
  assignmentHref: string | null;
}) {
  if (params.assignmentHref && !params.lessonHref) {
    return { label: "Open Assignment", href: params.assignmentHref };
  }
  if (params.scheduleStatus === "completed") {
    return { label: "Review", href: params.lessonHref ?? params.assignmentHref ?? "/student/progress" };
  }
  if (params.workStatus === "in_progress") {
    return { label: "Continue", href: params.lessonHref ?? params.assignmentHref ?? "/student/lessons" };
  }
  return { label: "Start Lesson", href: params.lessonHref ?? params.assignmentHref ?? "/student/lessons" };
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

    const catchUpStart = new Date(startOfDay.getTime() - 14 * 86400000);

    const [scheduledWork, catchUpWork, assignments, intelligence, adaptiveResult] = await Promise.all([
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
      prisma.scheduledWork.findMany({
        where: {
          classId: { in: classIds },
          scheduledDate: { gte: catchUpStart, lt: startOfDay },
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
        orderBy: [{ scheduledDate: "desc" }, { periodNumber: "asc" }],
        take: 8,
      }),
      prisma.assignment.findMany({
        where: {
          classId: { in: classIds },
          dueAt: { gte: startOfDay, lt: endOfDay },
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          scheduledWorkId: true,
          submissions: {
            where: { studentId: student.id },
            select: { turnedInAt: true },
          },
        },
      }).catch(() => []),
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

    const assignmentsByWorkId = new Map(
      assignments
        .filter((assignment) => assignment.scheduledWorkId)
        .map((assignment) => [assignment.scheduledWorkId as string, assignment])
    );

    const mapWorkItem = (sw: (typeof scheduledWork)[number], index: number): TodayWorkItem => {
      const payload = sw.content.payload as any;
      const progress = sw.progress[0];
      let status: TodayWorkStatus = "not_started";
      if (progress?.completedAt) status = "completed";
      else if (progress?.startedAt) status = "in_progress";
      const lab = getLessonLabLinks({
        subject: sw.content.subject,
        grade: sw.content.grade,
      })[0] ?? null;
      const assignment = assignmentsByWorkId.get(sw.id) ?? null;

      return {
        id: sw.id,
        classId: sw.classId,
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
        assignment: assignment
          ? {
              id: assignment.id,
              title: assignment.title,
              href: `/student/assignments/${assignment.id}`,
              dueAt: assignment.dueAt?.toISOString() ?? null,
              status: assignment.submissions.some((submission) => submission.turnedInAt)
                ? "submitted"
                : "open",
            }
          : null,
      };
    };

    const items = scheduledWork.map(mapWorkItem);
    const catchUpItems = catchUpWork
      .map(mapWorkItem)
      .filter((item) => item.status !== "completed");

    const current = items.find((item) => item.status !== "completed") ?? items[0] ?? null;
    const next = current
      ? items.find((item) => item.order > current.order && item.status !== "completed") ?? null
      : null;
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const timetablePeriods = timetable?.periods ?? [];
    const workUsedInSchoolDay = new Set<string>();
    const firstOpenIndex = Math.max(
      0,
      (timetable?.configured ? timetablePeriods : items).findIndex((entry: any) => {
        if ("status" in entry) return entry.status !== "completed";
        return true;
      })
    );

    function findWorkForPeriod(period: NonNullable<typeof timetable>["periods"][number]) {
      const periodNumber = parsePeriodNumber(period.periodLabel);
      const byPeriod = items.find(
        (item) =>
          !workUsedInSchoolDay.has(item.id) &&
          item.classId === period.classId &&
          periodNumber != null &&
          item.periodNumber === periodNumber
      );
      if (byPeriod) return byPeriod;

      const byTime = items.find(
        (item) =>
          !workUsedInSchoolDay.has(item.id) &&
          item.classId === period.classId &&
          item.startTime === period.startTime &&
          item.endTime === period.endTime
      );
      if (byTime) return byTime;

      return items.find(
        (item) =>
          !workUsedInSchoolDay.has(item.id) &&
          item.classId === period.classId &&
          item.subject === period.subject
      ) ?? null;
    }

    const schoolDayItems = timetable?.configured
      ? timetablePeriods.map((period, index) => {
          const work = findWorkForPeriod(period);
          if (work) workUsedInSchoolDay.add(work.id);
          const assignmentHref = work?.assignment?.href ?? null;
          const lessonHref = work?.lessonHref ?? period.assignment?.lessonUrl ?? null;
          const scheduleStatus = resolveSlotStatus({
            status: work?.status ?? null,
            startTime: period.startTime,
            endTime: period.endTime,
            index,
            firstOpenIndex,
            nowMinutes,
          });
          return {
            id: `period:${period.id}`,
            source: "timetable",
            timetableId: period.id,
            scheduledWorkId: work?.id ?? null,
            assignmentId: work?.assignment?.id ?? period.assignment?.id ?? null,
            timeRange: timeRange(period.startTime, period.endTime),
            periodLabel: period.periodLabel,
            subject: period.subject,
            teacherName: period.teacherName,
            title: work?.assignment?.title ?? work?.title ?? period.assignment?.title ?? null,
            status: scheduleStatus,
            primaryAction: primaryActionFor({
              scheduleStatus,
              workStatus: work?.status ?? null,
              lessonHref,
              assignmentHref,
            }),
          };
        })
      : items.map((item, index) => {
          const scheduleStatus = resolveSlotStatus({
            status: item.status,
            startTime: item.startTime,
            endTime: item.endTime,
            index,
            firstOpenIndex,
            nowMinutes,
          });
          workUsedInSchoolDay.add(item.id);
          return {
            id: `work:${item.id}`,
            source: "scheduled_work",
            timetableId: null,
            scheduledWorkId: item.id,
            assignmentId: item.assignment?.id ?? null,
            timeRange: timeRange(item.startTime, item.endTime),
            periodLabel: item.periodNumber ? `Period ${item.periodNumber}` : `Learning block ${item.order}`,
            subject: item.subject,
            teacherName: null,
            title: item.assignment?.title ?? item.title,
            status: scheduleStatus,
            primaryAction: primaryActionFor({
              scheduleStatus,
              workStatus: item.status,
              lessonHref: item.lessonHref,
              assignmentHref: item.assignment?.href ?? null,
            }),
          };
        });

    const firstActionable = schoolDayItems.find((item) =>
      ["current", "upcoming", "missed"].includes(item.status)
    );
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
      catchUpItems,
      schoolDay: {
        mode: timetable?.configured ? "timetable" : items.length > 0 ? "learning_plan" : "setup_needed",
        title: "Todays School Day",
        note: timetable?.configured
          ? null
          : items.length > 0
            ? "Your school has not configured a full timetable yet, so we are showing todays learning plan."
            : "No school day schedule has been configured yet.",
        items: schoolDayItems,
      },
      todayFocus: {
        greeting: "Today Focus",
        primaryLabel: firstActionable?.primaryAction.label ?? smartContinue?.label ?? "Browse lessons",
        primaryHref: firstActionable?.primaryAction.href ?? smartContinue?.href ?? "/student/lessons",
        currentOrNext:
          firstActionable?.title ??
          current?.title ??
          next?.title ??
          smartContinue?.label ??
          "No current class",
        status: firstActionable?.status ?? null,
      },
      progressSnapshot: {
        lessonsCompleted: items.filter((item) => item.status === "completed").length,
        assignmentsDue: items.filter((item) => item.assignment?.status === "open").length,
        masterySummary: adaptiveResult.masteryAlerts?.length
          ? `${adaptiveResult.masteryAlerts.length} mastery alert${adaptiveResult.masteryAlerts.length === 1 ? "" : "s"}`
          : "No mastery alerts",
      },
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
