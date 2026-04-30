import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export type TeacherAlertType =
  | "INACTIVE_STUDENT"
  | "REPEATED_QUIZ_FAILURE"
  | "LOW_MASTERY"
  | "UNRESOLVED_INTERVENTION"
  | "CURRICULUM_GAP_AFFECTING_CLASS"
  | "ASSIGNMENT_MISSED_BY_GROUP"
  | "CLASS_AVERAGE_DROPPED";

export type TeacherAlertStatus = "ACTIVE" | "REVIEWED" | "DISMISSED";
export type TeacherAlertActionStatus = "available" | "needs_review" | "unsupported";

export type TeacherAlertActionPayload = {
  label: string;
  actionType: string;
  targetStudents: string[];
  targetClassId: string | null;
  evidence: string;
  status: TeacherAlertActionStatus;
  href: string | null;
};

export type TeacherAlertItem = {
  id: string;
  alertType: TeacherAlertType;
  severity: string;
  reason: string;
  studentId: string | null;
  weakConcept: string | null;
  weakLesson: string | null;
  recommendedAction: string | null;
  action: TeacherAlertActionPayload | null;
  studentHref: string | null;
  createdAt: Date;
};

type AtRiskStudent = {
  studentId: string;
  name: string;
  classId?: string;
  className?: string;
  daysSinceActivity: number;
  profileHref?: string;
};

type InterventionRec = {
  studentId: string;
  type: string;
  reason: string;
};

type WeakLesson = {
  contentId: string;
  title: string;
  avgScore: number;
  attemptCount: number;
};

type AssignmentCompletionGap = {
  assignmentId: string;
  assignmentTitle: string;
  missedCount: number;
  affectedStudents: Array<{ studentId: string; name: string }>;
};

type ClassAverageDrop = {
  classId: string;
  className: string;
  subject: string;
  currentAverage: number;
  previousAverage: number;
};

const INACTIVITY_THRESHOLD_DAYS = 7;
const WEAK_LESSON_THRESHOLD = 60; // avg score %
const QUIZ_FAIL_ATTEMPTS_MIN = 3;
const QUIZ_PASS_SCORE = 0.7; // 0..1 scale
const QUIZ_FAIL_LOOKBACK_DAYS = 21;

type TeacherAlertRowLike = {
  id: string;
  alertType: string;
  studentId: string | null;
  weakConcept: string | null;
  weakLesson: string | null;
  reason: string;
  recommendedAction: string | null;
};

function buildTeacherAlertAction(row: TeacherAlertRowLike): TeacherAlertActionPayload | null {
  const base = {
    targetStudents: row.studentId ? [row.studentId] : [],
    targetClassId: null,
    evidence: row.reason,
  };

  switch (row.alertType as TeacherAlertType) {
    case "REPEATED_QUIZ_FAILURE":
      return {
        ...base,
        label: "Prepare remediation",
        actionType: "ASSIGN_REMEDIATION_REVIEW",
        status: row.studentId && row.weakLesson ? "available" : "needs_review",
        href: row.studentId ? `/teacher/students/${row.studentId}` : "/teacher/interventions",
      };
    case "INACTIVE_STUDENT":
      return {
        ...base,
        label: "Record follow-up",
        actionType: "RECORD_FOLLOW_UP",
        status: row.studentId ? "available" : "needs_review",
        href: row.studentId ? `/teacher/students/${row.studentId}` : "/teacher/interventions",
      };
    case "UNRESOLVED_INTERVENTION":
      return {
        ...base,
        label: "Review intervention",
        actionType: "REVIEW_INTERVENTION",
        status: row.studentId ? "available" : "needs_review",
        href: "/teacher/interventions",
      };
    case "ASSIGNMENT_MISSED_BY_GROUP":
      return {
        ...base,
        label: "Create follow-up",
        actionType: "CREATE_FOLLOW_UP_REMINDER",
        status: "needs_review",
        href: "/teacher/assignments",
      };
    case "CLASS_AVERAGE_DROPPED":
      return {
        ...base,
        label: "Plan class review",
        actionType: "PLAN_CLASS_REVIEW",
        status: "needs_review",
        href: "/teacher/weekly-report",
      };
    case "CURRICULUM_GAP_AFFECTING_CLASS":
      return {
        ...base,
        label: "Generate review plan",
        actionType: "GENERATE_REVIEW_PLAN",
        status: "needs_review",
        href: "/teacher/schedule",
      };
    default:
      return {
        ...base,
        label: "Review manually",
        actionType: "UNSUPPORTED_ALERT_ACTION",
        status: "unsupported",
        href: null,
      };
  }
}

function mapTeacherAlertRow(row: any): TeacherAlertItem {
  return {
    id: row.id,
    alertType: row.alertType as TeacherAlertType,
    severity: row.severity,
    reason: row.reason,
    studentId: row.studentId ?? null,
    weakConcept: row.weakConcept ?? null,
    weakLesson: row.weakLesson ?? null,
    recommendedAction: row.recommendedAction ?? null,
    action: buildTeacherAlertAction(row),
    studentHref: row.studentId ? `/teacher/students/${row.studentId}` : null,
    createdAt: row.createdAt,
  };
}

export async function generateTeacherAlerts(
  teacherUserId: string,
  schoolId: string,
  input: {
    atRiskStudents: AtRiskStudent[];
    interventionRecommendations: InterventionRec[];
    weakLessons: WeakLesson[];
    classIds?: string[];
    assignmentCompletionGaps?: AssignmentCompletionGap[];
    classAverageDrops?: ClassAverageDrop[];
  }
): Promise<void> {
  const alerts: Array<{
    idempotencyKey: string;
    alertType: TeacherAlertType;
    severity: string;
    reason: string;
    studentId: string | null;
    weakConcept: string | null;
    weakLesson: string | null;
    recommendedAction: string | null;
  }> = [];

  for (const student of input.atRiskStudents) {
    if (student.daysSinceActivity >= INACTIVITY_THRESHOLD_DAYS) {
      alerts.push({
        idempotencyKey: `${teacherUserId}:INACTIVE_STUDENT:${student.studentId}:inactivity`,
        alertType: "INACTIVE_STUDENT",
        severity: student.daysSinceActivity >= 14 ? "high" : "medium",
        reason: `${student.name} hasn't been active for ${student.daysSinceActivity} days.`,
        studentId: student.studentId,
        weakConcept: null,
        weakLesson: null,
        recommendedAction: "Check in with the student or contact their guardian.",
      });
    }
  }

  for (const rec of input.interventionRecommendations) {
    alerts.push({
      idempotencyKey: `${teacherUserId}:UNRESOLVED_INTERVENTION:${rec.studentId}:${rec.type}`,
      alertType: "UNRESOLVED_INTERVENTION",
      severity: "medium",
      reason: rec.reason,
      studentId: rec.studentId,
      weakConcept: null,
      weakLesson: null,
      recommendedAction: "Review the student's progress and consider a targeted support session.",
    });
  }

  for (const lesson of input.weakLessons) {
    if (lesson.avgScore < WEAK_LESSON_THRESHOLD && lesson.attemptCount >= 3) {
      alerts.push({
        idempotencyKey: `${schoolId}:CURRICULUM_GAP_AFFECTING_CLASS:${lesson.contentId}:weak_lesson`,
        alertType: "CURRICULUM_GAP_AFFECTING_CLASS",
        severity: lesson.avgScore < 45 ? "high" : "medium",
        reason: `"${lesson.title}" is averaging ${Math.round(lesson.avgScore)}% across ${lesson.attemptCount} attempts.`,
        studentId: null,
        weakConcept: null,
        weakLesson: lesson.title,
        recommendedAction: "Re-teach the lesson or schedule a reteach session for the class.",
      });
    }
  }

  for (const gap of input.assignmentCompletionGaps ?? []) {
    if (gap.missedCount < 5) continue;
    const sampleNames = gap.affectedStudents.slice(0, 5).map((student) => student.name).join(", ");
    alerts.push({
      idempotencyKey: `${teacherUserId}:ASSIGNMENT_MISSED_BY_GROUP:${gap.assignmentId}`,
      alertType: "ASSIGNMENT_MISSED_BY_GROUP",
      severity: gap.missedCount >= 10 ? "high" : "medium",
      reason: `${gap.missedCount} students missed "${gap.assignmentTitle}".${sampleNames ? ` Affected students include ${sampleNames}.` : ""}`,
      studentId: null,
      weakConcept: null,
      weakLesson: null,
      recommendedAction: "Use the first five minutes of class to reset expectations and give a short completion window.",
    });
  }

  for (const drop of input.classAverageDrops ?? []) {
    const delta = Math.round(drop.previousAverage - drop.currentAverage);
    if (delta < 10 || drop.currentAverage >= 70) continue;
    alerts.push({
      idempotencyKey: `${teacherUserId}:CLASS_AVERAGE_DROPPED:${drop.classId}:${drop.subject}`,
      alertType: "CLASS_AVERAGE_DROPPED",
      severity: drop.currentAverage < 50 ? "high" : "medium",
      reason: `${drop.className} average in ${drop.subject.replace(/_/g, " ")} dropped ${delta} points to ${Math.round(drop.currentAverage)}%.`,
      studentId: null,
      weakConcept: drop.subject,
      weakLesson: null,
      recommendedAction: "Pause new content and reteach the weakest topic before the next assessment.",
    });
  }

  if (input.classIds && input.classIds.length > 0) {
    const cutoff = new Date(Date.now() - QUIZ_FAIL_LOOKBACK_DAYS * 86_400_000);
    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        classId: { in: input.classIds },
        source: "student.lesson.quiz.submit",
        submittedAt: { gte: cutoff },
      },
      select: { studentId: true, score: true, metadata: true },
    });

    // Group by (studentId, contentId from metadata)
    type FailGroup = { scores: number[]; contentId: string };
    const grouped = new Map<string, FailGroup>();
    for (const attempt of attempts) {
      if (!attempt.studentId) continue;
      const meta = (attempt.metadata ?? {}) as Record<string, unknown>;
      const contentId = typeof meta.contentId === "string" ? meta.contentId : null;
      if (!contentId) continue;
      const key = `${attempt.studentId}::${contentId}`;
      const existing = grouped.get(key) ?? { scores: [], contentId };
      existing.scores.push(attempt.score ?? 0);
      grouped.set(key, existing);
    }

    // Collect studentIds that need alerts
    const failingGroups: Array<{ studentId: string; contentId: string; count: number; maxScore: number }> = [];
    for (const [key, group] of grouped) {
      const [studentId] = key.split("::");
      if (group.scores.length < QUIZ_FAIL_ATTEMPTS_MIN) continue;
      const maxScore = Math.max(...group.scores);
      if (maxScore >= QUIZ_PASS_SCORE) continue;
      failingGroups.push({ studentId, contentId: group.contentId, count: group.scores.length, maxScore });
    }

    if (failingGroups.length > 0) {
      const uniqueStudentIds = [...new Set(failingGroups.map((g) => g.studentId))];
      const students = await prisma.student.findMany({
        where: { id: { in: uniqueStudentIds }, user: { schoolId } },
        select: { id: true, user: { select: { name: true } } },
      });
      const studentNameMap = new Map(students.map((s) => [s.id, s.user?.name ?? "Student"]));

      for (const group of failingGroups) {
        const studentName = studentNameMap.get(group.studentId) ?? "Student";
        alerts.push({
          idempotencyKey: `${teacherUserId}:REPEATED_QUIZ_FAILURE:${group.studentId}:${group.contentId}`,
          alertType: "REPEATED_QUIZ_FAILURE",
          severity: "high",
          reason: `${studentName} has failed the same quiz ${group.count} times (best score: ${Math.round(group.maxScore * 100)}%).`,
          studentId: group.studentId,
          weakConcept: null,
          weakLesson: group.contentId,
          recommendedAction: "Review the lesson with the student and assign targeted practice.",
        });
      }
    }
  }

  if (alerts.length === 0) return;

  const existingKeys = await prisma.teacherAlert
    .findMany({
      where: {
        teacherUserId,
        idempotencyKey: { in: alerts.map((a) => a.idempotencyKey) },
        status: { in: ["ACTIVE", "REVIEWED"] },
      },
      select: { idempotencyKey: true },
    })
    .then((rows) => new Set(rows.map((r) => r.idempotencyKey)));

  const newAlerts = alerts.filter((a) => !existingKeys.has(a.idempotencyKey));
  if (newAlerts.length === 0) return;

  await prisma.teacherAlert.createMany({
    data: newAlerts.map((a) => ({
      id: randomUUID(),
      teacherUserId,
      schoolId,
      studentId: a.studentId,
      alertType: a.alertType,
      severity: a.severity,
      reason: a.reason,
      weakConcept: a.weakConcept,
      weakLesson: a.weakLesson,
      recommendedAction: a.recommendedAction,
      idempotencyKey: a.idempotencyKey,
      status: "ACTIVE",
    })),
    skipDuplicates: true,
  });
}

export async function getActiveTeacherAlerts(
  teacherUserId: string,
  schoolId: string
): Promise<TeacherAlertItem[]> {
  const ALERT_MAX_AGE_DAYS = 14;
  const cutoff = new Date(Date.now() - ALERT_MAX_AGE_DAYS * 86_400_000);

  const rows = await prisma.teacherAlert.findMany({
    where: {
      teacherUserId,
      schoolId,
      status: "ACTIVE",
      createdAt: { gte: cutoff },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  const SEVERITY_ORDER: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const TYPE_PRIORITY: Record<TeacherAlertType, number> = {
    UNRESOLVED_INTERVENTION: 5,
    REPEATED_QUIZ_FAILURE: 4,
    LOW_MASTERY: 3,
    ASSIGNMENT_MISSED_BY_GROUP: 3,
    CLASS_AVERAGE_DROPPED: 3,
    INACTIVE_STUDENT: 2,
    CURRICULUM_GAP_AFFECTING_CLASS: 1,
  };

  return rows
    .sort((a, b) => {
      const sA = SEVERITY_ORDER[a.severity] ?? 0;
      const sB = SEVERITY_ORDER[b.severity] ?? 0;
      if (sB !== sA) return sB - sA;
      const pA = TYPE_PRIORITY[a.alertType as TeacherAlertType] ?? 0;
      const pB = TYPE_PRIORITY[b.alertType as TeacherAlertType] ?? 0;
      return pB - pA;
    })
    .map(mapTeacherAlertRow);
}

export async function getAllTeacherAlerts(
  teacherUserId: string,
  schoolId: string,
  filter: "all" | "active" | "reviewed" | "dismissed" = "all"
): Promise<TeacherAlertItem[]> {
  const ALERT_MAX_AGE_DAYS = 30;
  const cutoff = new Date(Date.now() - ALERT_MAX_AGE_DAYS * 86_400_000);

  const statusFilter =
    filter === "active"
      ? { status: "ACTIVE" as string }
      : filter === "reviewed"
      ? { status: "REVIEWED" as string }
      : filter === "dismissed"
      ? { status: "DISMISSED" as string }
      : { status: { in: ["ACTIVE", "REVIEWED", "DISMISSED"] as string[] } };

  const rows = await prisma.teacherAlert.findMany({
    where: {
      teacherUserId,
      schoolId,
      ...statusFilter,
      createdAt: { gte: cutoff },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return rows.map(mapTeacherAlertRow);
}

export async function markAlertReviewed(
  alertId: string,
  reviewedByUserId: string,
  schoolId: string
): Promise<void> {
  const alert = await prisma.teacherAlert.findFirst({
    where: { id: alertId, teacherUserId: reviewedByUserId, schoolId },
    select: { id: true, schoolId: true, alertType: true },
  });
  if (!alert) throw Object.assign(new Error("Alert not found"), { status: 404 });

  await prisma.teacherAlert.update({
    where: { id: alert.id },
    data: { status: "REVIEWED", reviewedAt: new Date(), reviewedByUserId },
  });

  logLearningEvent({
    eventType: "alert.teacher.reviewed",
    schoolId: alert.schoolId,
    actor: { type: "user", id: reviewedByUserId, role: "TEACHER" },
    target: { type: "teacher_alert", id: alertId },
    metadata: { alertType: alert.alertType },
  }).catch(() => null);
}

export async function dismissTeacherAlert(
  alertId: string,
  dismissedByUserId: string,
  schoolId: string,
  reason?: string
): Promise<void> {
  const alert = await prisma.teacherAlert.findFirst({
    where: { id: alertId, teacherUserId: dismissedByUserId, schoolId },
    select: { id: true, schoolId: true, alertType: true },
  });
  if (!alert) throw Object.assign(new Error("Alert not found"), { status: 404 });

  await prisma.teacherAlert.update({
    where: { id: alert.id },
    data: { status: "DISMISSED", dismissedAt: new Date(), dismissReason: reason ?? null },
  });

  logLearningEvent({
    eventType: "alert.teacher.dismissed",
    schoolId: alert.schoolId,
    actor: { type: "user", id: dismissedByUserId, role: "TEACHER" },
    target: { type: "teacher_alert", id: alertId },
    metadata: { alertType: alert.alertType, reason },
  }).catch(() => null);
}

export async function recordTeacherAlertAction(
  alertId: string,
  teacherUserId: string,
  schoolId: string,
  requestedActionType?: string
): Promise<{ action: TeacherAlertActionPayload; teacherActionId: string | null }> {
  const alert = await prisma.teacherAlert.findFirst({
    where: { id: alertId, teacherUserId, schoolId },
  });
  if (!alert) throw Object.assign(new Error("Alert not found"), { status: 404 });

  const action = buildTeacherAlertAction(alert);
  if (!action || action.status === "unsupported") {
    return {
      action:
        action ??
        {
          label: "Review manually",
          actionType: "UNSUPPORTED_ALERT_ACTION",
          targetStudents: [],
          targetClassId: null,
          evidence: alert.reason,
          status: "unsupported",
          href: null,
        },
      teacherActionId: null,
    };
  }

  if (requestedActionType && requestedActionType !== action.actionType) {
    throw Object.assign(new Error("Action type does not match alert"), { status: 400 });
  }

  const teacherAction = await (prisma as any).teacherAction.create({
    data: {
      teacherUserId,
      schoolId,
      studentId: alert.studentId ?? undefined,
      contentId: alert.alertType === "REPEATED_QUIZ_FAILURE" ? alert.weakLesson ?? undefined : undefined,
      actionType: `teacher_alert.${action.actionType}`,
      targetType: "teacher_alert",
      targetId: alert.id,
      subject: alert.weakConcept ?? undefined,
      metadata: {
        lifecycle: "draft",
        alertType: alert.alertType,
        action,
        requiresTeacherApproval: true,
      },
    },
  });

  logLearningEvent({
    eventType: "alert.teacher.action_drafted",
    schoolId,
    userId: teacherUserId,
    actor: { type: "user", id: teacherUserId, role: "TEACHER" },
    target: { type: "teacher_alert", id: alert.id },
    studentId: alert.studentId ?? undefined,
    contentId: alert.alertType === "REPEATED_QUIZ_FAILURE" ? alert.weakLesson ?? undefined : undefined,
    metadata: { alertType: alert.alertType, actionType: action.actionType, safeStatus: action.status },
  }).catch(() => null);

  return { action, teacherActionId: teacherAction.id ?? null };
}
