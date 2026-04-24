import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { autoTriggerIntervention } from "@/lib/interventions/interventionChains";
import type { MasteryAlert, AdaptiveRecommendation } from "@/lib/student/adaptiveRecommendations";

export type StudentActionType =
  | "ASSIGN_REVIEW_LESSON"
  | "ASSIGN_PRACTICE"
  | "RECOMMEND_TEACHER_SUPPORT"
  | "CONTENT_GAP_NOTICE";

export type ActionStatus = "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED" | "EXPIRED";
export type ActionSeverity = "low" | "medium" | "high" | "critical";

export type ActiveStudentAction = {
  id: string;
  actionType: StudentActionType;
  reason: string;
  severity: ActionSeverity;
  targetType: string | null;
  targetId: string | null;
  href: string;
  sourceSignal: string | null;
  createdAt: Date;
};

export type GenerateActionsSignals = {
  recommendation: AdaptiveRecommendation | null;
  masteryAlerts: MasteryAlert[];
  contentGap: boolean;
  grade?: number | null;
};

const ACTIVE_STATUSES = ["ACTIVE", "IN_PROGRESS", "pending"] as const;
const RECENTLY_RESOLVED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

function actionHref(
  actionType: StudentActionType,
  targetType: string | null,
  targetId: string | null
): string {
  if (actionType === "ASSIGN_REVIEW_LESSON" || actionType === "ASSIGN_PRACTICE") {
    if (targetType === "scheduled_work" && targetId) {
      return actionType === "ASSIGN_PRACTICE"
        ? `/student/lessons/${targetId}#lesson-quiz`
        : `/student/lessons/${targetId}`;
    }
  }
  if (actionType === "CONTENT_GAP_NOTICE") return "/student/lessons";
  if (actionType === "RECOMMEND_TEACHER_SUPPORT") return "/student/today";
  return "/student/lessons";
}

function classifyAction(
  recType: string,
  sourceSignal: string,
  masteryAlerts: MasteryAlert[],
  masteryPercent: number | null
): StudentActionType {
  const criticalCount = masteryAlerts.filter((a) => a.tier === "critical").length;

  if (sourceSignal === "assessment_attempt.persistent_low_score") {
    if ((masteryPercent !== null && masteryPercent < 50) || criticalCount >= 2) {
      return "RECOMMEND_TEACHER_SUPPORT";
    }
    return "ASSIGN_PRACTICE";
  }

  if (sourceSignal === "assessment_attempt.low_score" || recType === "RETRY_ASSESSMENT") {
    if (masteryPercent !== null && masteryPercent < 50) return "ASSIGN_REVIEW_LESSON";
    return "ASSIGN_PRACTICE";
  }

  if (sourceSignal === "student_progress.stale_incomplete" || recType === "REVIEW") {
    return "ASSIGN_REVIEW_LESSON";
  }

  return "ASSIGN_REVIEW_LESSON";
}

function actionSeverity(
  actionType: StudentActionType,
  masteryPercent: number | null
): ActionSeverity {
  if (actionType === "RECOMMEND_TEACHER_SUPPORT") return "high";
  if (masteryPercent !== null) {
    if (masteryPercent < 40) return "critical";
    if (masteryPercent < 55) return "high";
    if (masteryPercent < 70) return "medium";
  }
  return "low";
}

async function upsertAction(params: {
  studentId: string;
  schoolId: string;
  idempotencyKey: string;
  actionType: StudentActionType;
  reason: string;
  sourceSignal: string;
  severity: ActionSeverity;
  targetType: string | null;
  targetId: string | null;
  confidenceScore: number;
  expiresAt: Date;
}): Promise<void> {
  const existing = await prisma.interventionRecommendation.findFirst({
    where: {
      studentId: params.studentId,
      idempotencyKey: params.idempotencyKey,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { id: true },
  });
  if (existing) return;

  const recentResolved = await prisma.interventionRecommendation.findFirst({
    where: {
      studentId: params.studentId,
      idempotencyKey: params.idempotencyKey,
      status: { in: ["COMPLETED", "DISMISSED"] },
      updatedAt: { gte: new Date(Date.now() - RECENTLY_RESOLVED_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recentResolved) return;

  await prisma.interventionRecommendation.create({
    data: {
      studentId: params.studentId,
      schoolId: params.schoolId,
      recommendationType: params.actionType,
      reason: params.reason,
      confidenceScore: params.confidenceScore,
      status: "ACTIVE",
      idempotencyKey: params.idempotencyKey,
      severity: params.severity,
      sourceSignal: params.sourceSignal,
      targetType: params.targetType,
      targetId: params.targetId,
      expiresAt: params.expiresAt,
    },
  });
}

export async function generateStudentActions(
  studentId: string,
  schoolId: string,
  signals: GenerateActionsSignals
): Promise<void> {
  const { recommendation: rec, masteryAlerts, contentGap, grade } = signals;

  if (contentGap) {
    const key = `${studentId}:CONTENT_GAP_NOTICE:grade-${grade ?? "unknown"}:content_gap`;
    await upsertAction({
      studentId,
      schoolId,
      idempotencyKey: key,
      actionType: "CONTENT_GAP_NOTICE",
      reason:
        "Your grade has a curriculum gap — some content is still being prepared. Continue with the nearest available lesson.",
      sourceSignal: "content_gap",
      severity: "medium",
      targetType: "lesson_list",
      targetId: `grade-${grade ?? "unknown"}`,
      confidenceScore: 1.0,
      expiresAt: daysFromNow(7),
    });
  }

  if (rec) {
    const actionType = classifyAction(
      rec.type,
      rec.sourceSignal,
      masteryAlerts,
      rec.masteryPercent ?? null
    );
    const key = `${studentId}:${actionType}:${rec.subject}:${rec.sourceSignal}`;
    const severity = actionSeverity(actionType, rec.masteryPercent ?? null);
    const tType = rec.scheduledWorkId ? "scheduled_work" : rec.lessonId ? "lesson" : null;
    const tId = rec.scheduledWorkId ?? rec.lessonId ?? null;

    await upsertAction({
      studentId,
      schoolId,
      idempotencyKey: key,
      actionType,
      reason: rec.reason,
      sourceSignal: rec.sourceSignal,
      severity,
      targetType: tType,
      targetId: tId,
      confidenceScore: rec.confidenceTier === "high" ? 0.9 : rec.confidenceTier === "medium" ? 0.7 : 0.5,
      expiresAt: daysFromNow(actionType === "RECOMMEND_TEACHER_SUPPORT" ? 3 : 7),
    });

    if (actionType === "RECOMMEND_TEACHER_SUPPORT") {
      autoTriggerIntervention({
        studentId,
        schoolId,
        triggerType: "critical_mastery",
        masteryPercent: rec.masteryPercent ?? 0,
        subject: rec.subject,
      }).catch(() => null);
    }
  }

  const criticalAlerts = masteryAlerts.filter((a) => a.tier === "critical");
  if (criticalAlerts.length >= 2 && !rec) {
    const key = `${studentId}:RECOMMEND_TEACHER_SUPPORT:multi_concept:mastery.multi_critical`;
    await upsertAction({
      studentId,
      schoolId,
      idempotencyKey: key,
      actionType: "RECOMMEND_TEACHER_SUPPORT",
      reason: `Critical mastery gaps detected in ${criticalAlerts
        .slice(0, 3)
        .map((a) => a.concept)
        .join(", ")}.`,
      sourceSignal: "mastery.multi_critical",
      severity: "high",
      targetType: "support",
      targetId: "teacher",
      confidenceScore: 0.85,
      expiresAt: daysFromNow(3),
    });
  }
}

export async function getActiveStudentAction(
  studentId: string
): Promise<ActiveStudentAction | null> {
  // Expire stale actions first
  await prisma.interventionRecommendation.updateMany({
    where: {
      studentId,
      status: "ACTIVE",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const SEVERITY_ORDER: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const ACTION_PRIORITY: Record<string, number> = {
    RECOMMEND_TEACHER_SUPPORT: 96,
    ASSIGN_PRACTICE: 90,
    ASSIGN_REVIEW_LESSON: 80,
    CONTENT_GAP_NOTICE: 50,
  };

  const active = await prisma.interventionRecommendation.findMany({
    where: {
      studentId,
      status: { in: ["ACTIVE", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (active.length === 0) return null;

  const best = active.sort((a, b) => {
    const aPriority = ACTION_PRIORITY[a.recommendationType] ?? 0;
    const bPriority = ACTION_PRIORITY[b.recommendationType] ?? 0;
    if (bPriority !== aPriority) return bPriority - aPriority;
    const aSev = SEVERITY_ORDER[a.severity] ?? 0;
    const bSev = SEVERITY_ORDER[b.severity] ?? 0;
    return bSev - aSev;
  })[0];

  const href = actionHref(
    best.recommendationType as StudentActionType,
    best.targetType ?? null,
    best.targetId ?? null
  );

  return {
    id: best.id,
    actionType: best.recommendationType as StudentActionType,
    reason: best.reason,
    severity: (best.severity ?? "medium") as ActionSeverity,
    targetType: best.targetType ?? null,
    targetId: best.targetId ?? null,
    href,
    sourceSignal: best.sourceSignal ?? null,
    createdAt: best.createdAt,
  };
}

export async function resolveStudentAction(
  actionId: string,
  resolvedBy: string
): Promise<void> {
  const rec = await prisma.interventionRecommendation.update({
    where: { id: actionId },
    data: {
      status: "COMPLETED",
      resolvedAt: new Date(),
      resolvedBy,
    },
    select: { studentId: true, schoolId: true, recommendationType: true },
  });

  logLearningEvent({
    eventType: "action.student.resolved",
    studentId: rec.studentId,
    schoolId: rec.schoolId,
    actor: { type: "user", id: resolvedBy, role: "STUDENT" },
    target: { type: "student_action", id: actionId },
    metadata: { actionType: rec.recommendationType },
  }).catch(() => null);
}

export async function dismissStudentAction(
  actionId: string,
  dismissedBy: string,
  reason?: string
): Promise<void> {
  const rec = await prisma.interventionRecommendation.update({
    where: { id: actionId },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissReason: reason ?? null,
    },
    select: { studentId: true, schoolId: true, recommendationType: true },
  });

  logLearningEvent({
    eventType: "action.student.dismissed",
    studentId: rec.studentId,
    schoolId: rec.schoolId,
    actor: { type: "user", id: dismissedBy, role: "STUDENT" },
    target: { type: "student_action", id: actionId },
    metadata: { actionType: rec.recommendationType, reason },
  }).catch(() => null);
}
