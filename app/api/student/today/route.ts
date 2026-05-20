import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";
import { buildStudentLearningIntelligence } from "@/lib/student/learningIntelligence";
import { getAdaptiveRecommendations } from "@/lib/student/adaptiveRecommendations";
import { generateStudentActions, getActiveStudentAction } from "@/lib/intelligence/actionEngine";
import { getTimetableForStudent } from "@/lib/timetable/timetableService";
import { withRedisCache } from "@/lib/cache/redisCache";

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

type SchoolDayStatus = "current" | "upcoming" | "completed" | "missed";

type SchoolDayAction = {
  label: "Start Lesson" | "Continue" | "Open Assignment" | "Review";
  href: string;
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeSubject(value: unknown): string {
  return safeString(value, "GENERAL").toUpperCase().replace(/\s+/g, "_");
}

function safePayload(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

const BREAK_LABEL_RE = /break|lunch|recess|assembly/i;

function isBreakPeriod(label: string | null | undefined): boolean {
  return BREAK_LABEL_RE.test(label ?? "");
}

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
  scheduleStatus: SchoolDayStatus;
  workStatus: TodayWorkStatus | null;
  lessonHref: string | null;
  assignmentHref: string | null;
}): SchoolDayAction {
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

    // Cache student metadata (id + classIds) to avoid a DB roundtrip on every authenticated request.
    // 300s TTL: enrollment changes propagate within 5min.
    type StudentMeta = { id: string; classIds: string[] };
    const studentMeta = await withRedisCache<StudentMeta | null>(
      `cache:student-meta:${user.id}`,
      600,
      async () => {
        const s = await prisma.student.findUnique({
          where: { userId: user.id },
          select: { id: true, enrollments: { select: { classId: true } } },
        });
        if (!s) return null;
        return { id: s.id, classIds: s.enrollments.map((e) => e.classId) };
      }
    );

    if (!studentMeta) {
      return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
    }

    const { id: studentId, classIds } = studentMeta;
    if (classIds.length === 0) {
      return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
    }

    // Today's date range (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const dateStr = startOfDay.toISOString().slice(0, 10);
    const cacheKey = `cache:today:${user.id}:${dateStr}`;

    const todayData = await withRedisCache(cacheKey, 900, async () => {
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
            where: { studentId: studentId },
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
      getAdaptiveRecommendations(studentId, user.schoolId, user.id).catch(() => ({
        recommendation: null,
        masteryAlerts: [],
        contentGap: false,
        pacingSignal: "on_track" as const,
        weakTopicSequence: [],
      })),
    ]);

    // Fire-and-forget: persist adaptive signals as trackable actions
    generateStudentActions(studentId, user.schoolId ?? "", {
      recommendation: adaptiveResult.recommendation,
      masteryAlerts: adaptiveResult.masteryAlerts,
      contentGap: adaptiveResult.contentGap,
      grade: adaptiveResult.recommendation?.grade ?? null,
    }).catch(() => null);

    const activeAction = await getActiveStudentAction(studentId).catch(() => null);
    const timetable = await getTimetableForStudent(studentId, new Date()).catch(() => null);

    const safeAssignments = asArray(assignments);
    const safeIntelligence = {
      generatedAt:
        typeof intelligence.generatedAt === "string"
          ? intelligence.generatedAt
          : new Date().toISOString(),
      weaknesses: asArray(intelligence.weaknesses),
      recommendedNextActions: asArray(intelligence.recommendedNextActions),
    };
    const safeAdaptiveResult = {
      recommendation: adaptiveResult.recommendation ?? null,
      masteryAlerts: asArray(adaptiveResult.masteryAlerts),
      contentGap: Boolean(adaptiveResult.contentGap),
      pacingSignal: adaptiveResult.pacingSignal ?? "on_track",
      weakTopicSequence: asArray(adaptiveResult.weakTopicSequence),
    };

    const assignmentsByWorkId = new Map(
      safeAssignments
        .filter((assignment) => assignment.scheduledWorkId)
        .map((assignment) => [assignment.scheduledWorkId as string, assignment])
    );

    const mapWorkItem = (sw: any, index: number): TodayWorkItem => {
      const content = sw?.content ?? {};
      const payload = safePayload(content.payload);
      const subject = safeSubject(content.subject);
      const grade = safeNumber(content.grade, 0);
      const contentId = safeString(content.contentId, sw?.contentId ?? sw?.id ?? `work-${index + 1}`);
      const progress = asArray<any>(sw?.progress)[0] ?? null;
      let status: TodayWorkStatus = "not_started";
      if (progress?.completedAt) status = "completed";
      else if (progress?.startedAt) status = "in_progress";
      const lab = getLessonLabLinks({ subject, grade })[0] ?? null;
      const assignment = assignmentsByWorkId.get(sw?.id) ?? null;
      const workId = safeString(sw?.id, `work-${index + 1}`);

      return {
        id: workId,
        classId: safeString(sw?.classId, ""),
        contentId,
        title: safeString(payload.title, safeString(payload.topic, `${subject} Lesson`)),
        subject,
        grade,
        contentType: safeString(content.contentType, "LESSON"),
        estimatedDuration: safeNumber(payload.durationMins, 45),
        periodNumber: typeof sw?.periodNumber === "number" ? sw.periodNumber : null,
        startTime: typeof sw?.startTime === "string" ? sw.startTime : null,
        endTime: typeof sw?.endTime === "string" ? sw.endTime : null,
        status,
        completedAt: progress?.completedAt || null,
        order: index + 1,
        lessonHref: `/student/lessons/${workId}`,
        quizHref: `/student/lessons/${workId}#lesson-quiz`,
        lab: lab ? { ...lab, href: `/student/labs/${lab.labId}` } : null,
        assignment: assignment
          ? {
              id: assignment.id,
              title: assignment.title,
              href: `/student/assignments/${assignment.id}`,
              dueAt: assignment.dueAt?.toISOString() ?? null,
              status: asArray<any>(assignment.submissions).some((submission) => submission.turnedInAt)
                ? "submitted"
                : "open",
            }
          : null,
      };
    };

    const items = asArray(scheduledWork).map(mapWorkItem);
    const catchUpItems = asArray(catchUpWork)
      .map(mapWorkItem)
      .filter((item) => item.status !== "completed");

    const current = items.find((item) => item.status !== "completed") ?? items[0] ?? null;
    const next = current
      ? items.find((item) => item.order > current.order && item.status !== "completed") ?? null
      : null;
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const timetablePeriods = asArray(timetable?.periods).map((period: any, index) => ({
      id: safeString(period?.id, `period-${index + 1}`),
      classId: safeString(period?.classId, ""),
      periodLabel: safeString(period?.periodLabel, `Period ${index + 1}`),
      subject: isBreakPeriod(period?.periodLabel) ? null : (period?.subject ? safeSubject(period.subject) : null),
      startTime: typeof period?.startTime === "string" ? period.startTime : null,
      endTime: typeof period?.endTime === "string" ? period.endTime : null,
      teacherName:
        typeof period?.teacherName === "string" && period.teacherName.trim()
          ? period.teacherName
          : null,
      assignment: period?.assignment
        ? {
            id: safeString(period.assignment.id, `assignment-${index + 1}`),
            title: safeString(period.assignment.title, "Assigned work"),
            contentId:
              typeof period.assignment.contentId === "string"
                ? period.assignment.contentId
                : null,
            lessonUrl:
              typeof period.assignment.lessonUrl === "string"
                ? period.assignment.lessonUrl
                : null,
            instructions:
              typeof period.assignment.instructions === "string"
                ? period.assignment.instructions
                : null,
          }
        : null,
    }));
    const workUsedInSchoolDay = new Set<string>();
    const firstOpenIndex = Math.max(
      0,
      (timetable?.configured ? timetablePeriods : items).findIndex((entry: any) => {
        if ("status" in entry) return entry.status !== "completed";
        return true;
      })
    );

    function findWorkForPeriod(period: (typeof timetablePeriods)[number]) {
      const periodNumber = parsePeriodNumber(period.periodLabel);
      const byPeriod = items.find(
        (item) =>
          !workUsedInSchoolDay.has(item.id) &&
          item.classId &&
          period.classId &&
          item.classId === period.classId &&
          periodNumber != null &&
          item.periodNumber === periodNumber
      );
      if (byPeriod) return byPeriod;

      const byTime = items.find(
        (item) =>
          !workUsedInSchoolDay.has(item.id) &&
          item.classId &&
          period.classId &&
          item.classId === period.classId &&
          item.startTime === period.startTime &&
          item.endTime === period.endTime
      );
      if (byTime) return byTime;

      return items.find(
        (item) =>
          !workUsedInSchoolDay.has(item.id) &&
          item.classId &&
          period.classId &&
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
      ...safeIntelligence.recommendedNextActions.map((action) => ({
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

    return {
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
        masterySummary: safeAdaptiveResult.masteryAlerts.length
          ? `${safeAdaptiveResult.masteryAlerts.length} mastery alert${safeAdaptiveResult.masteryAlerts.length === 1 ? "" : "s"}`
          : "No mastery alerts",
      },
      subjects: Array.from(new Set(items.map((item) => item.subject))),
      completedCount: items.filter((item) => item.status === "completed").length,
      remainingCount: items.filter((item) => item.status !== "completed").length,
      currentItemId: current?.id ?? null,
      nextItemId: next?.id ?? null,
      priority: safeAdaptiveResult.recommendation?.type ?? null,
      recommendation: safeAdaptiveResult.recommendation
        ? {
            type: safeAdaptiveResult.recommendation.type,
            lessonId: safeAdaptiveResult.recommendation.lessonId,
            scheduledWorkId: safeAdaptiveResult.recommendation.scheduledWorkId,
            reason: safeAdaptiveResult.recommendation.reason,
            sourceSignal: safeAdaptiveResult.recommendation.sourceSignal,
            masteryPercent: safeAdaptiveResult.recommendation.masteryPercent,
            confidenceTier: safeAdaptiveResult.recommendation.confidenceTier,
          }
        : null,
      masteryAlerts: safeAdaptiveResult.masteryAlerts,
      contentGap: safeAdaptiveResult.contentGap,
      pacingSignal: safeAdaptiveResult.pacingSignal,
      weakTopicSequence: safeAdaptiveResult.weakTopicSequence,
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
        generatedAt: safeIntelligence.generatedAt,
        smartContinueHref: smartContinue?.href ?? "/student/lessons",
        smartContinueLabel: smartContinue?.label ?? "Browse lessons",
        smartContinueReason:
          smartContinue?.reason ??
          "No scheduled, incomplete, or weak-area recommendation is available right now.",
        orderedActions: adaptiveActions,
        signals: {
          scheduledToday: items.length,
          incompleteToday: items.filter((item) => item.status !== "completed").length,
          weaknessCount: safeIntelligence.weaknesses.length,
          recommendationCount: safeIntelligence.recommendedNextActions.length,
        },
      },
      timetable: timetable ?? null,
    };
    }); // end withRedisCache

    return NextResponse.json(todayData);
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
