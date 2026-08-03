import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";
import { buildStudentLearningIntelligence } from "@/lib/student/learningIntelligence";
import { getAdaptiveRecommendations } from "@/lib/student/adaptiveRecommendations";
import { generateStudentActions, getActiveStudentAction } from "@/lib/intelligence/actionEngine";
import { getTimetableForStudent } from "@/lib/timetable/timetableService";
import { withRedisCache, FALLBACK_LIMIT_EXCEEDED, getCachedValue, setCachedValue } from "@/lib/cache/redisCache";
import { isWaecEligible } from "@/lib/waec/eligibility";
import { getStudentWaecReadinessAll, type SubjectReadiness } from "@/lib/waec/readiness";
import { waecSlug } from "@/lib/waec/syllabus";
import { getCertificateProximity } from "@/lib/certificates/certificateProgress";
import {
  rankNextBestActions,
  scoreRevisitPrerequisite,
  scoreOverdue,
  scoreCriticalMastery,
  scoreScheduledToday,
  scoreWaecPractice,
  scoreRetryAssessment,
  scoreReview,
  CONTINUE_PRIORITY,
  ADVANCE_PRIORITY,
  type NextActionCandidate,
} from "@/lib/student/nextBestAction";

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

// Fail-closed: students may only see scheduled work backed by approved content.
const APPROVED_CONTENT_STATUSES = ["published", "APPROVED"];

type TodayWorkStatus = "not_started" | "in_progress" | "completed";

type TodayWorkItem = {
  id: string;
  classId: string;
  contentId: string;
  title: string;
  subject: string;
  grade: number;
  scheduledDate: Date;
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
  // Shield: cap the entire handler at 8000ms so pgbouncer-congested responses
  // return a degraded HTTP 200 rather than timing out at 20-30s.
  // 8s budget: enough for a cold Redis miss + parallel DB queries on first morning load.
  // Under real load (warm cache) the inner function returns in <100ms.
  const shieldResult = await Promise.race([
    _computeToday(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
  if (shieldResult === null) {
    // The schedule itself (which periods, which subjects, which lessons) is
    // stable day to day — only the date label and completion status change.
    // Rather than flash an empty "no lessons today" dashboard on a cold
    // start, serve the last successfully computed snapshot for this student
    // while the real computation keeps running in the background and
    // refreshes the short-TTL cache for the next request.
    const user = await requireRole("STUDENT").catch(() => null);
    if (user) {
      const stale = await getCachedValue(`cache:today:lastgood:${user.id}`);
      if (stale) return NextResponse.json(stale);
    }
    return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
  }
  return shieldResult;
}

async function _computeToday(): Promise<NextResponse> {
  try {
    const user = await requireRole("STUDENT");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 403 });
    }

    // Cache student metadata (id + classIds) to avoid a DB roundtrip on every authenticated request.
    // 700s TTL: must outlive full load-test window (83s warm + 540s test = 623s).
    type StudentMeta = { id: string; classIds: string[]; currentGrade: number | null };
    const studentMeta = await withRedisCache<StudentMeta | null>(
      `cache:student-meta:${user.id}`,
      700,
      async () => {
        const s = await prisma.student.findUnique({
          where: { userId: user.id },
          select: { id: true, currentGrade: true, enrollments: { select: { classId: true } } },
        });
        if (!s) return null;
        return { id: s.id, classIds: s.enrollments.map((e) => e.classId), currentGrade: s.currentGrade ?? null };
      }
    );

    if (!studentMeta) {
      return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
    }

    const { id: studentId, classIds, currentGrade } = studentMeta;
    if (classIds.length === 0) {
      // No class enrollment yet, but WAEC readiness is computed straight from
      // mastery data and never depended on class enrollment. A WAEC-eligible
      // student in this state should still get a real recommendation instead
      // of a bare empty page (Sprint 6.7 Deliverable 1: this was the exact
      // gap found in the real walkthrough of a Grade 11 WAEC-track student).
      const emptyStatePayload: Record<string, unknown> = { items: [], adaptivePlan: emptyAdaptivePlan() };
      if (isWaecEligible(currentGrade)) {
        const readiness = await getStudentWaecReadinessAll(studentId).catch(() => [] as SubjectReadiness[]);
        const weakest = readiness
          .filter((s) => s.available && s.readiness != null && s.readiness < 75)
          .sort((a, b) => (a.readiness as number) - (b.readiness as number))[0];
        if (weakest && weakest.readiness != null) {
          const reason = `Your ${weakest.name} readiness is ${weakest.readiness}%${weakest.nextFocusName ? `, next focus: ${weakest.nextFocusName}` : ""}.`;
          emptyStatePayload.heroRecommendation = {
            type: "WAEC_PRACTICE",
            label: `${weakest.name} practice`,
            reason,
            href: `/student/waec/${waecSlug(weakest.subjectId)}/practice`,
            subject: weakest.name,
            priority: scoreWaecPractice(weakest.readiness),
          };
          emptyStatePayload.waecSecondaryCard = null;
        }
      }
      return NextResponse.json(emptyStatePayload);
    }

    // Today's date range (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const dateStr = startOfDay.toISOString().slice(0, 10);
    const cacheKey = `cache:today:${user.id}:${dateStr}`;

    const todayData = await withRedisCache(cacheKey, 900, async () => {
    const catchUpStart = new Date(startOfDay.getTime() - 14 * 86400000);

    const [scheduledWork, catchUpWork, assignments, overdueAssignments, intelligence, adaptiveResult, waecReadiness] = await Promise.all([
      prisma.scheduledWork.findMany({
        where: {
          classId: { in: classIds },
          scheduledDate: { gte: startOfDay, lt: endOfDay },
          content: { status: { in: APPROVED_CONTENT_STATUSES } },
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
        orderBy: [{ periodNumber: "asc" }, { startTime: "asc" }],
      }),
      prisma.scheduledWork.findMany({
        where: {
          classId: { in: classIds },
          scheduledDate: { gte: catchUpStart, lt: startOfDay },
          content: { status: { in: APPROVED_CONTENT_STATUSES } },
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
      prisma.assignment.findMany({
        where: {
          classId: { in: classIds },
          dueAt: { lt: startOfDay },
          submissions: { none: { studentId } },
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          scheduledWorkId: true,
        },
        orderBy: { dueAt: "desc" },
        take: 5,
      }).catch(() => []),
      buildStudentLearningIntelligence(user).catch(() => ({
        generatedAt: new Date().toISOString(),
        masteryBySubject: [],
        weaknesses: [],
        recommendedNextActions: [],
      })),
      getAdaptiveRecommendations(studentId, user.schoolId, user.id).catch(() => ({
        recommendation: null,
        candidates: [],
        masteryAlerts: [],
        contentGap: false,
        pacingSignal: "on_track" as const,
        weakTopicSequence: [],
      })),
      isWaecEligible(currentGrade)
        ? getStudentWaecReadinessAll(studentId).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Fire-and-forget: persist adaptive signals as trackable actions
    generateStudentActions(studentId, user.schoolId ?? "", {
      recommendation: adaptiveResult.recommendation,
      masteryAlerts: adaptiveResult.masteryAlerts,
      contentGap: adaptiveResult.contentGap,
      grade: adaptiveResult.recommendation?.grade ?? null,
    }).catch(() => null);

    // Run in parallel and cache so DB is not hit on every request at 1K VUs.
    // Action TTL=60s (changes when resolved/generated); timetable TTL=300s (day-stable).
    const [activeAction, timetable] = await Promise.all([
      withRedisCache(
        `cache:action:${studentId}:${dateStr}`,
        60,
        () => getActiveStudentAction(studentId).catch(() => null)
      ),
      withRedisCache(
        `cache:timetable:${studentId}:${dateStr}`,
        300,
        () => getTimetableForStudent(studentId, new Date()).catch(() => null)
      ),
    ]);

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
      candidates: asArray((adaptiveResult as { candidates?: unknown[] }).candidates),
      masteryAlerts: asArray(adaptiveResult.masteryAlerts),
      contentGap: Boolean(adaptiveResult.contentGap),
      pacingSignal: adaptiveResult.pacingSignal ?? "on_track",
      weakTopicSequence: asArray(adaptiveResult.weakTopicSequence),
    };
    const safeOverdueAssignments = asArray(overdueAssignments);
    const safeWaecReadiness = asArray(waecReadiness);

    const overdueWorkIds = safeOverdueAssignments
      .map((a) => a.scheduledWorkId)
      .filter((id): id is string => typeof id === "string");
    const overdueSubjectByWorkId = new Map<string, string>();
    if (overdueWorkIds.length > 0) {
      const overdueWork = await prisma.scheduledWork
        .findMany({
          where: { id: { in: overdueWorkIds } },
          select: { id: true, content: { select: { subject: true } } },
        })
        .catch(() => []);
      for (const w of overdueWork) {
        if (w.content?.subject) overdueSubjectByWorkId.set(w.id, w.content.subject);
      }
    }

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
        scheduledDate: sw?.scheduledDate instanceof Date ? sw.scheduledDate : new Date(sw?.scheduledDate ?? Date.now()),
        contentType: safeString(content.contentType, "LESSON"),
        estimatedDuration: safeNumber(payload.durationMins, 45),
        periodNumber: typeof sw?.periodNumber === "number" ? sw.periodNumber : null,
        startTime: typeof sw?.startTime === "string" ? sw.startTime : null,
        endTime: typeof sw?.endTime === "string" ? sw.endTime : null,
        status,
        completedAt: progress?.completedAt || null,
        order: index + 1,
        lessonHref: `/student/lessons/${contentId}`,
        quizHref: `/student/lessons/${contentId}#lesson-quiz`,
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

    // Sprint 6.7: deterministic "what should this student do next" ranking.
    // Every candidate is built from data already fetched above, no parallel
    // data sources. See lib/student/nextBestAction.ts for the scoring model.
    const scheduledStatusByWorkId = new Map(
      schoolDayItems
        .filter((entry) => entry.scheduledWorkId)
        .map((entry) => [entry.scheduledWorkId as string, entry.status])
    );

    const nextBestCandidates: NextActionCandidate[] = [];

    for (const c of safeAdaptiveResult.candidates as Array<{
      type: string;
      lessonId: string | null;
      subject: string;
      reason: string;
      sourceSignal: string;
      masteryPercent: number | null;
    }>) {
      if (!c.lessonId) continue;
      const href = `/student/lessons/${c.lessonId}`;
      if (c.type === "REVISIT_PREREQUISITE") {
        nextBestCandidates.push({
          type: "REVISIT_PREREQUISITE",
          priority: scoreRevisitPrerequisite(c.masteryPercent ?? 60),
          label: `Review ${c.subject}`,
          reason: c.reason,
          href,
          subject: c.subject,
          masteryPercent: c.masteryPercent,
          lastSignalAt: null,
        });
      } else if (c.type === "RETRY_ASSESSMENT") {
        nextBestCandidates.push({
          type: "RETRY_ASSESSMENT",
          priority: scoreRetryAssessment(c.masteryPercent ?? 50),
          label: "Retry quiz",
          reason: c.reason,
          href: `${href}#lesson-quiz`,
          subject: c.subject,
          masteryPercent: c.masteryPercent,
          lastSignalAt: null,
        });
      } else if (c.type === "REVIEW" && c.sourceSignal !== "student_progress.stale_incomplete" && c.masteryPercent != null) {
        nextBestCandidates.push({
          type: "REVIEW",
          priority: scoreReview(c.masteryPercent),
          label: `Review ${c.subject}`,
          reason: c.reason,
          href,
          subject: c.subject,
          masteryPercent: c.masteryPercent,
          lastSignalAt: null,
        });
      } else if (c.type === "CONTINUE") {
        nextBestCandidates.push({
          type: "CONTINUE",
          priority: CONTINUE_PRIORITY,
          label: `Continue ${c.subject}`,
          reason: c.reason,
          href,
          subject: c.subject,
          masteryPercent: c.masteryPercent,
          lastSignalAt: null,
        });
      } else if (c.type === "ADVANCE") {
        nextBestCandidates.push({
          type: "ADVANCE",
          priority: ADVANCE_PRIORITY,
          label: `Start ${c.subject}`,
          reason: c.reason,
          href,
          subject: c.subject,
          masteryPercent: c.masteryPercent,
          lastSignalAt: null,
        });
      }
    }

    // Today's scheduled items still count, but only as SCHEDULED_TODAY, not the
    // hardcoded 105-110 priority that used to make them always win.
    for (const item of items) {
      if (item.status === "completed") continue;
      const isCurrentPeriod = scheduledStatusByWorkId.get(item.id) === "current";
      nextBestCandidates.push({
        type: "SCHEDULED_TODAY",
        priority: scoreScheduledToday(isCurrentPeriod),
        label: item.status === "in_progress" ? `Continue ${item.title}` : `Start ${item.title}`,
        reason: isCurrentPeriod ? "This is your current class period." : "Scheduled as part of today's learning plan.",
        href: item.lessonHref,
        subject: item.subject,
        masteryPercent: null,
        lastSignalAt: null,
      });
    }

    // Overdue: past-due assignments (real due dates, teacher accountability).
    for (const assignment of safeOverdueAssignments as Array<{
      id: string;
      title: string;
      dueAt: Date | null;
      scheduledWorkId: string | null;
    }>) {
      if (!assignment.dueAt) continue;
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - assignment.dueAt.getTime()) / 86_400_000));
      nextBestCandidates.push({
        type: "OVERDUE",
        priority: scoreOverdue(daysOverdue),
        label: `Overdue: ${assignment.title}`,
        reason: `This assignment was due ${daysOverdue === 0 ? "today" : `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago`}.`,
        href: `/student/assignments/${assignment.id}`,
        subject: (assignment.scheduledWorkId && overdueSubjectByWorkId.get(assignment.scheduledWorkId)) ?? "GENERAL",
        masteryPercent: null,
        lastSignalAt: assignment.dueAt.toISOString(),
      });
    }

    // Overdue: lessons abandoned mid-progress from the catch-up window.
    for (const item of catchUpItems) {
      const daysOverdue = Math.max(0, Math.floor((startOfDay.getTime() - item.scheduledDate.getTime()) / 86_400_000));
      if (daysOverdue < 2) continue;
      nextBestCandidates.push({
        type: "OVERDUE",
        priority: scoreOverdue(daysOverdue),
        label: `Catch up: ${item.title}`,
        reason: `This lesson was scheduled ${daysOverdue} days ago and is still not started.`,
        href: item.lessonHref,
        subject: item.subject,
        masteryPercent: null,
        lastSignalAt: item.scheduledDate.toISOString(),
      });
    }

    // Critical mastery: the single weakest subject, when it has a real lesson to point to.
    const topAlert = safeAdaptiveResult.masteryAlerts[0];
    const topWeakLesson = safeAdaptiveResult.weakTopicSequence[0];
    if (topAlert?.tier === "critical" && topWeakLesson?.lessonId) {
      nextBestCandidates.push({
        type: "CRITICAL_MASTERY",
        priority: scoreCriticalMastery(topAlert.score),
        label: `Review ${topAlert.subject}`,
        reason: topWeakLesson.reason,
        href: `/student/lessons/${topWeakLesson.lessonId}`,
        subject: topAlert.subject,
        masteryPercent: topAlert.score,
        lastSignalAt: null,
      });
    }

    // WAEC practice: weakest assessed subject below the practice threshold (Grade 9+ only).
    const weakestWaec = (safeWaecReadiness as SubjectReadiness[])
      .filter((s) => s.available && s.readiness != null && s.readiness < 75)
      .sort((a, b) => (a.readiness as number) - (b.readiness as number))[0];
    if (weakestWaec && weakestWaec.readiness != null) {
      nextBestCandidates.push({
        type: "WAEC_PRACTICE",
        priority: scoreWaecPractice(weakestWaec.readiness),
        label: `${weakestWaec.name} practice`,
        reason: `Your ${weakestWaec.name} readiness is ${weakestWaec.readiness}%${weakestWaec.nextFocusName ? `, next focus: ${weakestWaec.nextFocusName}` : ""}.`,
        href: `/student/waec/${waecSlug(weakestWaec.subjectId)}/practice`,
        subject: weakestWaec.name,
        masteryPercent: weakestWaec.readiness,
        lastSignalAt: null,
      });
    }

    const { hero: heroCandidate, waecSecondary } = rankNextBestActions(nextBestCandidates);

    let unlocks: Awaited<ReturnType<typeof getCertificateProximity>> = null;
    if (heroCandidate && currentGrade != null) {
      unlocks = await getCertificateProximity(
        studentId,
        user.id,
        heroCandidate.subject,
        currentGrade,
        user.schoolId ?? null
      ).catch(() => null);
      if (unlocks?.alreadyAwarded) unlocks = null;
    }

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
      heroRecommendation: heroCandidate
        ? {
            type: heroCandidate.type,
            label: heroCandidate.label,
            reason: heroCandidate.reason,
            href: heroCandidate.href,
            subject: heroCandidate.subject,
            priority: heroCandidate.priority,
          }
        : null,
      waecSecondaryCard: waecSecondary
        ? {
            label: waecSecondary.label,
            reason: waecSecondary.reason,
            href: waecSecondary.href,
            subject: waecSecondary.subject,
          }
        : null,
      unlocks,
      timetable: timetable ?? null,
      schoolId: user.schoolId ?? null,
    };
    }); // end withRedisCache

    // Best-effort, fire-and-forget: keep a long-TTL "last known good" copy so
    // a future cold-start shield timeout has real data to fall back to.
    setCachedValue(`cache:today:lastgood:${user.id}`, todayData, 7 * 86400).catch(() => {});

    return NextResponse.json(todayData);
  } catch (err: any) {
    // DB fallback limit exceeded — return degraded 200 immediately rather than
    // propagating a 503 that would fail the k6 'today 200' check.
    if (err?.code === FALLBACK_LIMIT_EXCEEDED) {
      return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan() });
    }
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
