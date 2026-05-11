import { prisma } from "@/lib/db";
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
      value: disengagementCount,
      threshold: 2,
      direction: "above",
      weight: 2,
      label: "Disengagement events",
      evidence: learningEvents.slice(0, 5).flatMap((row: any) => ref("LearningEvent", row.id, row.schoolId)),
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
      value: frictionCount,
      threshold: 2,
      direction: "above",
      weight: 3,
      label: "Open curriculum friction flags",
      evidence: curriculumFlags.slice(0, 5).flatMap((row: any) => ref("CurriculumFlag", row.id, row.schoolId)),
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
      value: Number(((progress.filter((row: any) => row.completedAt).length / Math.max(1, progress.length)) * 100).toFixed(1)),
      threshold: 60,
      direction: "below",
      weight: 3,
      label: "Curriculum coverage proxy",
      evidence: progress.slice(0, 5).flatMap((row: any) => ref("StudentProgress", row.id, schoolId)),
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
    },
  };
  assertTenantSafeEvidence(context, evidence);
  return evidence;
}
