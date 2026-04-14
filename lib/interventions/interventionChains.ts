import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

type JsonObject = Record<string, unknown>;

function toJson(value?: JsonObject | null): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

export type InterventionChainStage = "baseline" | "intervention" | "outcome" | "retention";

function stageTimestamps(stage: InterventionChainStage) {
  const now = new Date();
  if (stage === "baseline") return {};
  if (stage === "intervention") return { interventionStartedAt: now };
  if (stage === "outcome") return { outcomeMeasuredAt: now };
  return { retentionCheckedAt: now };
}

export async function openInterventionChain(input: {
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  studentId?: string | null;
  teacherUserId?: string | null;
  openedByUserId?: string | null;
  openedByRole?: string | null;
  attributionSource?: string | null;
  rationale?: string | null;
  sourceAssessmentAttemptId?: string | null;
  baselineSnapshotId?: string | null;
  metadata?: JsonObject | null;
}) {
  const chain = await prisma.interventionChain.create({
    data: {
      tenantId: input.tenantId ?? null,
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      studentId: input.studentId ?? null,
      teacherUserId: input.teacherUserId ?? null,
      openedByUserId: input.openedByUserId ?? null,
      openedByRole: input.openedByRole ?? null,
      attributionSource: input.attributionSource ?? null,
      rationale: input.rationale ?? null,
      sourceAssessmentAttemptId: input.sourceAssessmentAttemptId ?? null,
      baselineSnapshotId: input.baselineSnapshotId ?? null,
      metadata: toJson(input.metadata),
    },
  });

  await logLearningEvent({
    schoolId: input.schoolId ?? null,
    studentId: input.studentId ?? null,
    userId: input.openedByUserId ?? null,
    actor: input.openedByUserId
      ? { type: "user", id: input.openedByUserId, role: input.openedByRole ?? null }
      : null,
    target: { type: "intervention_chain", id: chain.id },
    eventType: "intervention.chain.opened",
    source: input.attributionSource ?? "intervention_chain",
    metadata: {
      currentStage: "baseline",
      sourceAssessmentAttemptId: input.sourceAssessmentAttemptId ?? null,
      baselineSnapshotId: input.baselineSnapshotId ?? null,
    },
  });

  return chain;
}

export async function advanceInterventionChainStage(input: {
  chainId: string;
  stage: InterventionChainStage;
  status?: string | null;
  schoolId?: string | null;
  studentId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  attributionSource?: string | null;
  metadata?: JsonObject | null;
  intervention?: {
    tenantId?: string | null;
    schoolId?: string | null;
    districtId?: string | null;
    studentId?: string | null;
    teacherUserId?: string | null;
    recommendationId?: string | null;
    interventionType: string;
    status?: string | null;
    channel?: string | null;
    priority?: string | null;
    objective?: string | null;
    details?: JsonObject | null;
    sourceAttemptId?: string | null;
  } | null;
}) {
  let interventionId: string | null = null;

  if (input.intervention) {
    const intervention = await prisma.intervention.create({
      data: {
        tenantId: input.intervention.tenantId ?? null,
        schoolId: input.intervention.schoolId ?? input.schoolId ?? null,
        districtId: input.intervention.districtId ?? null,
        studentId: input.intervention.studentId ?? input.studentId ?? null,
        teacherUserId: input.intervention.teacherUserId ?? input.userId ?? null,
        recommendationId: input.intervention.recommendationId ?? null,
        interventionType: input.intervention.interventionType,
        status: input.intervention.status ?? "open",
        channel: input.intervention.channel ?? null,
        priority: input.intervention.priority ?? null,
        objective: input.intervention.objective ?? null,
        details: toJson(input.intervention.details),
        chainId: input.chainId,
        chainStage: input.stage,
        attributionSource: input.attributionSource ?? null,
        openedByUserId: input.userId ?? null,
        sourceAttemptId: input.intervention.sourceAttemptId ?? null,
      },
      select: { id: true },
    });
    interventionId = intervention.id;
  }

  const chain = await prisma.interventionChain.update({
    where: { id: input.chainId },
    data: {
      currentStage: input.stage,
      status: input.status ?? undefined,
      latestInterventionId: interventionId ?? undefined,
      metadata: toJson(input.metadata),
      ...stageTimestamps(input.stage),
    },
  });

  await logLearningEvent({
    schoolId: input.schoolId ?? null,
    studentId: input.studentId ?? null,
    userId: input.userId ?? null,
    actor: input.userId ? { type: "user", id: input.userId, role: input.userRole ?? null } : null,
    target: { type: "intervention_chain", id: input.chainId },
    eventType: "intervention.chain.stage_changed",
    source: input.attributionSource ?? "intervention_chain",
    metadata: {
      currentStage: input.stage,
      interventionId,
      status: input.status ?? null,
    },
  });

  return { chain, interventionId };
}

export async function closeInterventionChain(input: {
  chainId: string;
  schoolId?: string | null;
  studentId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  attributionSource?: string | null;
  closedStatus?: string | null;
  metadata?: JsonObject | null;
}) {
  const chain = await prisma.interventionChain.update({
    where: { id: input.chainId },
    data: {
      status: input.closedStatus ?? "closed",
      closedAt: new Date(),
      metadata: toJson(input.metadata),
    },
  });

  await logLearningEvent({
    schoolId: input.schoolId ?? null,
    studentId: input.studentId ?? null,
    userId: input.userId ?? null,
    actor: input.userId ? { type: "user", id: input.userId, role: input.userRole ?? null } : null,
    target: { type: "intervention_chain", id: input.chainId },
    eventType: "intervention.chain.closed",
    source: input.attributionSource ?? "intervention_chain",
    metadata: {
      status: input.closedStatus ?? "closed",
    },
  });

  return chain;
}

export async function listOpenInterventionChains(filter: {
  schoolId?: string | null;
  studentId?: string | null;
  teacherUserId?: string | null;
  attributionSource?: string | null;
}) {
  return prisma.interventionChain.findMany({
    where: {
      status: "open",
      ...(filter.schoolId ? { schoolId: filter.schoolId } : {}),
      ...(filter.studentId ? { studentId: filter.studentId } : {}),
      ...(filter.teacherUserId ? { teacherUserId: filter.teacherUserId } : {}),
      ...(filter.attributionSource ? { attributionSource: filter.attributionSource } : {}),
    },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      schoolId: true,
      studentId: true,
      teacherUserId: true,
      openedByUserId: true,
      openedByRole: true,
      attributionSource: true,
      status: true,
      currentStage: true,
      sourceAssessmentAttemptId: true,
      baselineSnapshotId: true,
      latestInterventionId: true,
      openedAt: true,
    },
  });
}
