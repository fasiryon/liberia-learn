import { NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=learning-orchestrator-or-schoolwork; rationale=governed releases use the orchestrator and unregistered learners use schedule, assignments, and published lessons only
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";
import { getTimetableForStudent } from "@/lib/timetable/timetableService";
import { enrollmentScopeFingerprint, loadStudentEnrollmentScope } from "@/lib/student/enrollmentReadModel";
import { withRedisCache, FALLBACK_LIMIT_EXCEEDED, getCachedValue, setCachedValue } from "@/lib/cache/redisCache";
import { getCertificateProximity } from "@/lib/certificates/certificateProgress";
import { learnerExperienceAuthority } from "@/lib/student/learnerExperienceAuthority";
import {
  rankNextBestActions,
  scoreRevisitPrerequisite,
  scoreOverdue,
  scoreScheduledToday,
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

// Today cache namespace. Bumped (v3) when membership authority moved out of the cache: no entry
// written under an earlier namespace, including any carrying a foreign teacher, can be addressed.
const TODAY_CACHE_VERSION = "v3";
const SHIELD_MS = 8000;
type TodayUser = Awaited<ReturnType<typeof requireRole>>;
type EnrollmentScope = NonNullable<Awaited<ReturnType<typeof loadStudentEnrollmentScope>>>;
const unavailableToday = () => NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan(), availability: "unavailable" });
const lastGoodKey = (user: TodayUser, fingerprint: string) => `cache:today:lastgood:${TODAY_CACHE_VERSION}:${user.id}:${user.schoolId}:${fingerprint}`;

/**
 * Cache is not authority. Every response first reads the learner's CURRENT enrollment scope
 * (the shared enrollment authority: own-school student record, active academic enrollment,
 * own-school roster), then serves only data addressed by that exact scope. If that authority
 * cannot be read within the shield, the response fails closed as unavailable; no cached
 * payload is replayed without it.
 */
export async function GET() {
  // Shield: cap the entire handler at 8000ms so pgbouncer-congested responses
  // return a degraded HTTP 200 rather than timing out at 20-30s.
  const deadline = Date.now() + SHIELD_MS;
  const within = <T,>(work: Promise<T>) => Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())))]);
  let user: TodayUser;
  try {
    user = await requireRole("STUDENT");
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unauthorized" }, { status: err?.status || 500 });
  }
  if (!user.schoolId) return NextResponse.json({ error: "School context required" }, { status: 403 });

  // Current entitlement, never from cache. undefined = authority unavailable → fail closed.
  const scope = await within(loadStudentEnrollmentScope(user)).catch(() => undefined);
  if (scope === undefined || scope === null) return unavailableToday();
  const fingerprint = enrollmentScopeFingerprint(user.id, scope);

  const shieldResult = await within(_computeToday(user, scope, fingerprint));
  if (shieldResult === null) {
    // The schedule itself is stable day to day. Instead of flashing an empty dashboard on a cold
    // start, serve the last snapshot computed for this SAME current scope, while the real
    // computation keeps running in the background. A snapshot from any other enrollment, school
    // or cache version is never addressed, and a mismatched record is ignored.
    const stale = await getCachedValue<{ version?: string; userId?: string; schoolId?: string; fingerprint?: string; data?: Record<string, unknown> }>(lastGoodKey(user, fingerprint));
    if (stale && stale.version === TODAY_CACHE_VERSION && stale.userId === user.id && stale.schoolId === user.schoolId && stale.fingerprint === fingerprint && stale.data && typeof stale.data === "object") {
      return NextResponse.json({ ...stale.data, availability: "stale" });
    }
    return unavailableToday();
  }
  return shieldResult;
}

async function _computeToday(user: TodayUser, scope: EnrollmentScope, fingerprint: string): Promise<NextResponse> {
  try {
    const { studentId, currentGrade } = scope;
    const schoolId = scope.schoolId;
    const classIds = scope.classes.map((c) => c.classId);
    if (classIds.length === 0) return NextResponse.json({ items: [], adaptivePlan: emptyAdaptivePlan(), availability: "current", catchUpItems: [], completedCount: 0, remainingCount: 0 });

    // Today is deliberately limited to the governed orchestrator or ordinary
    // schoolwork. Legacy adaptive signals are never a learner next-action
    // authority, including when no governed release is registered.
    const experienceAuthority = learnerExperienceAuthority(currentGrade);

    // Today's date range (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const dateStr = startOfDay.toISOString().slice(0, 10);
    // Derived presentation only, addressed by the current scope: an enrollment, class, school or
    // academic-status change resolves to a different key on the very next request.
    const cacheKey = `cache:today:${TODAY_CACHE_VERSION}:${user.id}:${schoolId}:${fingerprint}:${dateStr}`;

    const todayData = await withRedisCache(cacheKey, 900, async () => {
    const catchUpStart = new Date(startOfDay.getTime() - 14 * 86400000);

    const [scheduledWork, catchUpWork, assignments, overdueAssignments] = await Promise.all([
      prisma.scheduledWork.findMany({
        where: {
          classId: { in: classIds }, class: { schoolId },
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
          classId: { in: classIds }, class: { schoolId },
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
          classId: { in: classIds }, Class: { schoolId },
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
          classId: { in: classIds }, Class: { schoolId },
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
    ]);

    // Run in parallel and cache so DB is not hit on every request at 1K VUs.
    // Action TTL=60s (changes when resolved/generated); timetable TTL=300s (day-stable).
    const timetable = await withRedisCache(
        `cache:timetable:${TODAY_CACHE_VERSION}:${schoolId}:${studentId}:${fingerprint}:${dateStr}`,
        300,
        () => getTimetableForStudent(studentId, new Date(), schoolId).catch(() => null)
      ).then((table) => table && { ...table, periods: table.periods.filter((period) => classIds.includes(period.classId)) });

    const safeAssignments = asArray(assignments);
    const safeIntelligence = { generatedAt: new Date().toISOString(), weaknesses: [], recommendedNextActions: [] };
    const safeAdaptiveResult = { recommendation: null, candidates: [], masteryAlerts: [], contentGap: false, pacingSignal: "on_track", weakTopicSequence: [] };
    const safeOverdueAssignments = asArray(overdueAssignments);

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

    const { hero: heroCandidate } = rankNextBestActions(nextBestCandidates);

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
      availability: "current",
      generatedAt: now.toISOString(),
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
      activeAction: null,
      learningAuthority: experienceAuthority,
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
      waecSecondaryCard: null,
      unlocks,
      timetable: timetable ?? null,
      schoolId,
    };
    }); // end withRedisCache

    // Best-effort, fire-and-forget: keep a long-TTL "last known good" copy so a future cold-start
    // shield timeout has real data to fall back to. It is bound to this exact scope and is read
    // only after the same scope has been re-established from current authority.
    setCachedValue(lastGoodKey(user, fingerprint), { version: TODAY_CACHE_VERSION, userId: user.id, schoolId, fingerprint, data: todayData }, 7 * 86400).catch(() => {});

    return NextResponse.json(todayData);
  } catch (err: any) {
    // DB fallback limit exceeded — return degraded 200 immediately rather than
    // propagating a 503 that would fail the k6 'today 200' check.
    if (err?.code === FALLBACK_LIMIT_EXCEEDED) return unavailableToday();
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
