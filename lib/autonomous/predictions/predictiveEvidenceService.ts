import { prisma } from "@/lib/db";
import type { ForecastRange, ForecastScope } from "@/lib/autonomous/predictions/types";

export function parseForecastRange(input: { from?: string | null; to?: string | null } = {}, now = new Date()): ForecastRange {
  const fromDefault = new Date(now);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 30);
  const from = input.from ? new Date(`${input.from}T00:00:00.000Z`) : fromDefault;
  const to = input.to ? new Date(`${input.to}T23:59:59.999Z`) : now;
  const safeFrom = Number.isNaN(from.getTime()) ? fromDefault : from;
  const safeTo = Number.isNaN(to.getTime()) ? now : to;
  return safeFrom <= safeTo ? { from: safeFrom, to: safeTo } : { from: safeTo, to: safeFrom };
}

export function forecastScopeWhere(scope: ForecastScope) {
  if (scope.aggregateSafe) return {};
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

export async function loadPredictiveEvidence(input: { scope: ForecastScope; range: ForecastRange; targetId?: string | null }) {
  const where: any = {
    ...forecastScopeWhere(input.scope),
    occurredAt: { gte: input.range.from, lte: input.range.to },
  };
  if (input.targetId && !input.scope.aggregateSafe) where.studentId = input.targetId;

  const [events, decisions, workflowRuns, memoryEvents, evaluationEvents] = await Promise.all([
    (prisma as any).learningEvent?.findMany?.({
      where,
      orderBy: { occurredAt: "desc" },
      take: 5000,
      select: {
        id: true,
        schoolId: true,
        districtId: true,
        classId: true,
        studentId: true,
        userId: true,
        contentId: true,
        lessonId: true,
        subject: true,
        grade: true,
        eventType: true,
        status: true,
        occurredAt: true,
        metadata: true,
        qualityMarkers: true,
      },
    }) ?? [],
    (prisma as any).agentDecision?.findMany?.({
      where: { createdAt: { gte: input.range.from, lte: input.range.to } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { id: true, workflowRunId: true, decisionType: true, status: true, riskLevel: true, confidence: true, evidenceRefs: true, decision: true, createdAt: true },
    }) ?? [],
    (prisma as any).workflowRun?.findMany?.({
      where: { ...forecastScopeWhere(input.scope), createdAt: { gte: input.range.from, lte: input.range.to } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { id: true, workflowType: true, schoolId: true, districtId: true, status: true, riskLevel: true, targetType: true, targetId: true, evidenceRefs: true, createdAt: true },
    }) ?? [],
    (prisma as any).learningEvent?.findMany?.({
      where: {
        ...forecastScopeWhere(input.scope),
        eventType: "autonomous.memory.recorded",
        occurredAt: { gte: input.range.from, lte: input.range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: { id: true, schoolId: true, districtId: true, eventType: true, occurredAt: true, metadata: true },
    }) ?? [],
    (prisma as any).learningEvent?.findMany?.({
      where: {
        ...forecastScopeWhere(input.scope),
        eventType: { in: ["autonomous.evaluation.recorded", "predictive.forecast.outcome_recorded"] },
        occurredAt: { gte: input.range.from, lte: input.range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
      select: { id: true, schoolId: true, districtId: true, eventType: true, occurredAt: true, metadata: true },
    }) ?? [],
  ]);

  return { events, decisions, workflowRuns, memoryEvents, evaluationEvents };
}
