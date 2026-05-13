import { prisma } from "@/lib/db";
import { categoryForEventType } from "@/lib/autonomous/signals/productSignalService";
import type { DetectorContext, DetectorEvidence, DetectorEvidenceRef, DetectorSignal } from "@/lib/autonomous/detectors/types";

function ref(type: string, id: string | null | undefined, schoolId?: string | null, metadata?: Record<string, unknown>): DetectorEvidenceRef[] {
  if (!id) return [];
  return [{ type, id, schoolId: schoolId ?? null, metadata }];
}

function signal(input: Omit<DetectorSignal, "evidence"> & { evidence?: DetectorEvidenceRef[] }): DetectorSignal {
  return { ...input, evidence: input.evidence ?? [] };
}

function windowStart(days = 30) {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function schoolWhere(context: DetectorContext) {
  return context.schoolId ? { schoolId: context.schoolId } : {};
}

export function assertTenantSafeEvidence(context: DetectorContext, evidence: DetectorEvidence) {
  if (context.schoolId && evidence.schoolId !== context.schoolId) {
    throw Object.assign(new Error("Detector evidence crossed school tenant boundary"), {
      code: "detector_tenant_boundary_violation",
      status: 403,
    });
  }
  if (!context.schoolId && context.targetType !== "national_aggregate" && context.targetType !== "district") {
    throw Object.assign(new Error("Detector evidence requires school, district, or national aggregate scope"), {
      code: "detector_scope_ambiguous",
      status: 400,
    });
  }
}

export async function resolveDetectorEvidence(context: DetectorContext): Promise<DetectorEvidence> {
  const since = windowStart(30);
  const previousSince = windowStart(60);
  const targetId = context.targetId;
  const schoolId = context.schoolId ?? null;

  const [
    masteryRecent,
    masteryPrevious,
    attendance,
    attempts,
    progress,
    interventions,
    curriculumFlags,
    learningEvents,
  ] = await Promise.all([
    (prisma as any).masterySnapshot?.findMany?.({
      where: { ...schoolWhere(context), ...(context.targetType === "student" ? { studentId: targetId } : {}), capturedAt: { gte: since } },
      orderBy: { capturedAt: "desc" },
      take: 25,
    }) ?? [],
    (prisma as any).masterySnapshot?.findMany?.({
      where: {
        ...schoolWhere(context),
        ...(context.targetType === "student" ? { studentId: targetId } : {}),
        capturedAt: { gte: previousSince, lt: since },
      },
      orderBy: { capturedAt: "desc" },
      take: 25,
    }) ?? [],
    (prisma as any).attendance?.findMany?.({
      where: { ...schoolWhere(context), ...(context.targetType === "student" ? { studentId: targetId } : {}), date: { gte: since } },
      orderBy: { date: "desc" },
      take: 60,
    }) ?? [],
    (prisma as any).assessmentAttempt?.findMany?.({
      where: { ...schoolWhere(context), ...(context.targetType === "student" ? { studentId: targetId } : {}), createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }) ?? [],
    (prisma as any).studentProgress?.findMany?.({
      where: { ...(context.targetType === "student" ? { studentId: targetId } : {}), createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }) ?? [],
    (prisma as any).interventionRecommendation?.findMany?.({
      where: { ...schoolWhere(context), ...(context.targetType === "student" ? { studentId: targetId } : {}), createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }) ?? [],
    (prisma as any).curriculumFlag?.findMany?.({
      where: { ...schoolWhere(context), status: "open", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }) ?? [],
    (prisma as any).learningEvent?.findMany?.({
      where: { ...schoolWhere(context), ...(context.targetType === "student" ? { studentId: targetId } : {}), occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }) ?? [],
  ]);

  const recentAvg =
    masteryRecent.length > 0
      ? masteryRecent.reduce((sum: number, row: any) => sum + Number(row.currentScore ?? row.hybridScore ?? 0), 0) / masteryRecent.length
      : 0;
  const previousAvg =
    masteryPrevious.length > 0
      ? masteryPrevious.reduce((sum: number, row: any) => sum + Number(row.currentScore ?? row.hybridScore ?? 0), 0) / masteryPrevious.length
      : recentAvg;
  const absentCount = attendance.filter((row: any) => String(row.status).toLowerCase() === "absent").length;
  const failedAttempts = attempts.filter((row: any) => Number(row.score ?? row.scorePct ?? 1) < 0.6).length;
  const incompleteProgress = progress.filter((row: any) => !row.completedAt).length;
  const pendingInterventions = interventions.filter((row: any) => row.status === "pending").length;
  const frictionCount = curriculumFlags.length;
  const disengagementCount = learningEvents.filter((row: any) =>
    ["lesson.abandoned", "assignment.missed", "student.inactive"].includes(row.eventType)
  ).length;
  const eventsByType: Record<string, any[]> = learningEvents.reduce((acc: Record<string, any[]>, row: any) => {
    acc[row.eventType] = acc[row.eventType] ?? [];
    acc[row.eventType].push(row);
    return acc;
  }, {});
  const countEvents = (...eventTypes: string[]) => eventTypes.reduce((sum, eventType) => sum + (eventsByType[eventType]?.length ?? 0), 0);
  const eventEvidence = (...eventTypes: string[]) =>
    eventTypes.flatMap((eventType) => (eventsByType[eventType] ?? []).slice(0, 5).flatMap((row: any) => ref("LearningEvent", row.id, row.schoolId, { eventType: row.eventType })));
  const productSignalCategories = new Set(learningEvents.map((row: any) => categoryForEventType(row.eventType)).filter(Boolean));
  const assignmentSubmitted = countEvents("assignment.submitted");
  const assignmentGraded = countEvents("assignment.graded");
  const lessonCompleted = countEvents("lesson.completed");
  const lessonStarted = countEvents("lesson.started");
  const aiTutorUsage = learningEvents.filter((row: any) => row.eventType === "ai.interaction" && row.metadata?.feature === "tutor").length;
  const reportCardGenerated = countEvents("report_card.generated");
  const reportCardPublished = countEvents("report_card.published");
  const guardianViews = countEvents("guardian.report_card.viewed");
  const attendanceUpdates = countEvents("attendance.updated", "offline.sync.attendance.accepted", "live_session.attendance_marked");
  const liveSessionJoins = countEvents("live_session.joined");
  const pushDeliveries = countEvents("push.notification.delivered");
  const discussionParticipation = countEvents("discussion.thread.created", "discussion.post.created", "discussion.post.upvoted");
  const completionRate = lessonStarted > 0 ? lessonCompleted / lessonStarted : lessonCompleted > 0 ? 1 : 0;

  const signals: DetectorSignal[] = [
    signal({
      key: "masteryCollapsePct",
      value: Number(((recentAvg - previousAvg) * 100).toFixed(1)),
      threshold: 15,
      direction: "decline",
      weight: 4,
      label: "Mastery decline over prior window",
      evidence: masteryRecent.slice(0, 5).flatMap((row: any) => ref("MasterySnapshot", row.id, row.schoolId)),
    }),
    signal({
      key: "attendanceDeclinePct",
      value: attendance.length ? Number(((absentCount / attendance.length) * 100).toFixed(1)) : 0,
      threshold: 25,
      direction: "above",
      weight: 3,
      label: "Absence rate in evidence window",
      evidence: attendance.slice(0, 5).flatMap((row: any) => ref("Attendance", row.id, row.schoolId)),
    }),
    signal({
      key: "failedAssessmentCount",
      value: failedAttempts,
      threshold: 2,
      direction: "above",
      weight: 3,
      label: "Repeated failed assessments",
      evidence: attempts.slice(0, 5).flatMap((row: any) => ref("AssessmentAttempt", row.id, row.schoolId)),
    }),
    signal({
      key: "assignmentAvoidanceCount",
      value: incompleteProgress,
      threshold: 3,
      direction: "above",
      weight: 2,
      label: "Incomplete or avoided assigned work",
      evidence: progress.slice(0, 5).flatMap((row: any) => ref("StudentProgress", row.id, schoolId)),
    }),
    signal({
      key: "disengagementEventCount",
      value: disengagementCount + Math.max(0, assignmentSubmitted - assignmentGraded),
      threshold: 2,
      direction: "above",
      weight: 2,
      label: "Disengagement events",
      evidence: eventEvidence("assignment.submitted", "assignment.graded", "lesson.abandoned", "assignment.missed", "student.inactive"),
    }),
    signal({
      key: "ungradedSubmissionCount",
      value: Math.max(0, assignmentSubmitted - assignmentGraded),
      threshold: 5,
      direction: "above",
      weight: 3,
      label: "Submitted assignments awaiting grading signal",
      evidence: eventEvidence("assignment.submitted", "assignment.graded"),
    }),
    signal({
      key: "slowInterventionResponseDays",
      value: pendingInterventions,
      threshold: 5,
      direction: "above",
      weight: 3,
      label: "Pending intervention queue",
      evidence: interventions.slice(0, 5).flatMap((row: any) => ref("InterventionRecommendation", row.id, row.schoolId)),
    }),
    signal({
      key: "curriculumFrictionCount",
      value: frictionCount + Math.max(0, aiTutorUsage - lessonCompleted),
      threshold: 2,
      direction: "above",
      weight: 3,
      label: "Open curriculum friction flags",
      evidence: [
        ...curriculumFlags.slice(0, 5).flatMap((row: any) => ref("CurriculumFlag", row.id, row.schoolId)),
        ...eventEvidence("ai.interaction", "lesson.completed"),
      ],
    }),
    signal({
      key: "lowComprehensionPct",
      value: recentAvg ? Number(((1 - recentAvg) * 100).toFixed(1)) : 0,
      threshold: 35,
      direction: "above",
      weight: 3,
      label: "Low comprehension proxy from mastery",
      evidence: masteryRecent.slice(0, 5).flatMap((row: any) => ref("MasterySnapshot", row.id, row.schoolId)),
    }),
    signal({
      key: "curriculumCoveragePct",
      value: Number((Math.max(completionRate, progress.filter((row: any) => row.completedAt).length / Math.max(1, progress.length)) * 100).toFixed(1)),
      threshold: 60,
      direction: "below",
      weight: 3,
      label: "Curriculum coverage proxy",
      evidence: [...progress.slice(0, 5).flatMap((row: any) => ref("StudentProgress", row.id, schoolId)), ...eventEvidence("lesson.completed", "lesson.started")],
    }),
    signal({
      key: "sustainedDeclinePct",
      value: Number(((recentAvg - previousAvg) * 100).toFixed(1)),
      threshold: 10,
      direction: "decline",
      weight: 4,
      label: "Sustained student decline",
      evidence: masteryRecent.slice(0, 5).flatMap((row: any) => ref("MasterySnapshot", row.id, row.schoolId)),
    }),
    signal({
      key: "weakLessonEffectivenessPct",
      value: lessonStarted > 0 ? Number(((1 - completionRate) * 100).toFixed(1)) : 0,
      threshold: 40,
      direction: "above",
      weight: 3,
      label: "Weak lesson effectiveness proxy from start/completion signals",
      evidence: eventEvidence("lesson.started", "lesson.completed", "ai.interaction"),
    }),
    signal({
      key: "reportingGapDays",
      value: reportCardGenerated > 0 || reportCardPublished > 0 ? 0 : 31,
      threshold: 30,
      direction: "above",
      weight: 2,
      label: "Report-card signal freshness gap",
      evidence: eventEvidence("report_card.generated", "report_card.published"),
    }),
    signal({
      key: "attendanceConcernCount",
      value: Math.max(absentCount, attendanceUpdates === 0 ? 1 : 0),
      threshold: 2,
      direction: "above",
      weight: 2,
      label: "Attendance concerns from records and update signals",
      evidence: [...attendance.slice(0, 5).flatMap((row: any) => ref("Attendance", row.id, row.schoolId)), ...eventEvidence("attendance.updated", "live_session.attendance_marked")],
    }),
    signal({
      key: "interventionFollowupDays",
      value: guardianViews > 0 || pushDeliveries > 0 ? 0 : pendingInterventions,
      threshold: 5,
      direction: "above",
      weight: 2,
      label: "Guardian follow-through signal gap",
      evidence: eventEvidence("guardian.report_card.viewed", "push.notification.delivered", "push.notification.opened"),
    }),
    signal({
      key: "operationalInconsistencyCount",
      value: productSignalCategories.size < 3 ? 3 - productSignalCategories.size : 0,
      threshold: 1,
      direction: "above",
      weight: 2,
      label: "Missing product signal coverage for operational consistency",
      evidence: learningEvents.slice(0, 10).flatMap((row: any) => ref("LearningEvent", row.id, row.schoolId, { eventType: row.eventType })),
    }),
    signal({
      key: "schoolAnomalyCount",
      value: Math.max(0, assignmentSubmitted - assignmentGraded) + Math.max(0, lessonStarted - lessonCompleted) + (attendanceUpdates === 0 ? 1 : 0),
      threshold: 5,
      direction: "above",
      weight: 3,
      label: "Aggregate school anomaly proxy from real product signals",
      evidence: learningEvents.slice(0, 10).flatMap((row: any) => ref("LearningEvent", row.id, row.schoolId, { eventType: row.eventType })),
    }),
    signal({
      key: "nationalConcernScore",
      value: Math.min(100, Math.max(0, 20 + Math.max(0, assignmentSubmitted - assignmentGraded) * 5 + (attendanceUpdates === 0 ? 20 : 0))),
      threshold: 60,
      direction: "above",
      weight: 2,
      label: "National aggregate concern proxy from signal coverage",
      evidence: learningEvents.slice(0, 10).flatMap((row: any) => ref("LearningEvent", row.id, row.schoolId, { eventType: row.eventType })),
    }),
    signal({
      key: "curriculumBottleneckCount",
      value: Math.max(0, aiTutorUsage - lessonCompleted) + Math.max(0, discussionParticipation - lessonCompleted),
      threshold: 3,
      direction: "above",
      weight: 3,
      label: "Curriculum bottleneck proxy from tutor and discussion activity",
      evidence: eventEvidence("ai.interaction", "discussion.thread.created", "discussion.post.created", "lesson.completed"),
    }),
    signal({
      key: "policyComplianceRiskCount",
      value: reportCardPublished > reportCardGenerated + 5 ? 1 : 0,
      threshold: 1,
      direction: "above",
      weight: 3,
      label: "Governance policy compliance risk from report-card signal mismatch",
      evidence: eventEvidence("report_card.generated", "report_card.published"),
    }),
    signal({
      key: "systemicPerformanceShiftPct",
      value: lessonStarted > 0 ? Number(((lessonCompleted / lessonStarted - 1) * 100).toFixed(1)) : 0,
      threshold: 20,
      direction: "decline",
      weight: 3,
      label: "Systemic performance shift from lesson signal conversion",
      evidence: eventEvidence("lesson.started", "lesson.completed"),
    }),
    signal({
      key: "districtPerformanceDeclinePct",
      value: recentAvg ? Number(((recentAvg - previousAvg) * 100).toFixed(1)) : 0,
      threshold: 10,
      direction: "decline",
      weight: 3,
      label: "District performance decline proxy with product event lineage",
      evidence: [...masteryRecent.slice(0, 5).flatMap((row: any) => ref("MasterySnapshot", row.id, row.schoolId)), ...eventEvidence("lesson.completed", "assignment.graded")],
    }),
  ];

  const evidence = {
    tenantId: context.tenantId ?? schoolId,
    schoolId,
    districtId: context.districtId ?? null,
    targetType: context.targetType,
    targetId,
    windowKey: context.windowKey ?? `${since.toISOString().slice(0, 10)}:${new Date().toISOString().slice(0, 10)}`,
    signals,
    summary: {
      masteryRows: masteryRecent.length,
      attendanceRows: attendance.length,
      assessmentRows: attempts.length,
      progressRows: progress.length,
      interventionRows: interventions.length,
      curriculumFlagRows: curriculumFlags.length,
      learningEventRows: learningEvents.length,
      productSignalCategories: Array.from(productSignalCategories).sort(),
      assignmentSubmitted,
      assignmentGraded,
      lessonCompleted,
      aiTutorUsage,
      guardianViews,
      liveSessionJoins,
      pushDeliveries,
    },
  };
  assertTenantSafeEvidence(context, evidence);
  return evidence;
}
