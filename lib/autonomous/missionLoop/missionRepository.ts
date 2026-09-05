// lib/autonomous/missionLoop/missionRepository.ts
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  assertLegalPhaseTransition,
  deriveMissionStatus,
} from "@/lib/autonomous/missionLoop/phaseStateMachine";
import type {
  AcceptanceCriterion,
  ChecklistItemStatus,
  MissionDetail,
  MissionStatus,
  PhaseDetail,
  PhaseInput,
  PhaseStatus,
} from "@/lib/autonomous/missionLoop/types";

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toCriteria(value: unknown): AcceptanceCriterion[] {
  return Array.isArray(value) ? (value as AcceptanceCriterion[]) : [];
}

// Prisma's generated Json input types reject a bare `unknown`, and a bare JS `null`
// is ambiguous between "store SQL NULL" (Prisma.DbNull) and "store the JSON literal
// null" (Prisma.JsonNull). These fields are all optional/absent-by-default, so an
// unset value maps to Prisma.DbNull.
function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

type RawPhase = {
  id: string;
  workflowRunId: string;
  sequence: number;
  title: string;
  objective: string;
  acceptanceCriteria: unknown;
  status: string;
  dependsOnPhaseIds: unknown;
  attempt: number;
  lastProgressAt: Date | null;
  blockedReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type RawChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  status: string;
  evidenceRef: unknown;
  completedAt: Date | null;
};

function toPhaseDetail(phase: RawPhase, checklist: RawChecklistItem[]): PhaseDetail {
  return {
    id: phase.id,
    workflowRunId: phase.workflowRunId,
    sequence: phase.sequence,
    title: phase.title,
    objective: phase.objective,
    acceptanceCriteria: toCriteria(phase.acceptanceCriteria),
    status: phase.status as PhaseStatus,
    dependsOnPhaseIds: toStringArray(phase.dependsOnPhaseIds),
    attempt: phase.attempt,
    lastProgressAt: phase.lastProgressAt,
    blockedReason: phase.blockedReason,
    startedAt: phase.startedAt,
    completedAt: phase.completedAt,
    checklist: checklist.map((item) => ({
      id: item.id,
      label: item.label,
      required: item.required,
      status: item.status as ChecklistItemStatus,
      evidenceRef: item.evidenceRef,
      completedAt: item.completedAt,
    })),
  };
}

export async function createMission(
  input: {
    slug: string;
    objective: string;
    scope?: unknown;
    constraints?: unknown;
    acceptanceCriteria?: AcceptanceCriterion[];
    dependsOnRunIds?: string[];
  },
  db: PrismaClient,
): Promise<{ id: string }> {
  const traceId = `mission-${input.slug}-${Date.now()}`;
  const run = await db.workflowRun.create({
    data: {
      workflowType: `mission.${input.slug}`,
      partitionKey: `mission:${input.slug}`,
      traceId,
      correlationId: traceId,
      status: "pending",
      objective: input.objective,
      scope: toJsonInput(input.scope),
      constraints: toJsonInput(input.constraints),
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      dependsOnRunIds: input.dependsOnRunIds ?? [],
    },
  });
  return { id: run.id };
}

export async function planPhases(
  missionId: string,
  phases: PhaseInput[],
  db: PrismaClient,
): Promise<{ phaseIds: string[] }> {
  const phaseIds: string[] = [];
  for (const phase of phases) {
    const created = await db.workflowPhase.create({
      data: {
        workflowRunId: missionId,
        sequence: phase.sequence,
        title: phase.title,
        objective: phase.objective,
        acceptanceCriteria: phase.acceptanceCriteria,
        status: "NOT_STARTED",
        dependsOnPhaseIds: phase.dependsOnPhaseIds ?? [],
      },
    });
    phaseIds.push(created.id);
    for (const item of phase.checklist) {
      await db.workflowChecklistItem.create({
        data: {
          workflowPhaseId: created.id,
          label: item.label,
          required: item.required ?? true,
          status: "PENDING",
        },
      });
    }
  }
  return { phaseIds };
}

export async function getMissionDetail(missionId: string, db: PrismaClient): Promise<MissionDetail | null> {
  const run = await db.workflowRun.findUnique({ where: { id: missionId } });
  if (!run) return null;
  const phases = (await db.workflowPhase.findMany({
    where: { workflowRunId: missionId },
    orderBy: { sequence: "asc" },
  })) as RawPhase[];
  const phaseDetails: PhaseDetail[] = [];
  for (const phase of phases) {
    const checklist = (await db.workflowChecklistItem.findMany({
      where: { workflowPhaseId: phase.id },
      orderBy: { createdAt: "asc" },
    })) as RawChecklistItem[];
    phaseDetails.push(toPhaseDetail(phase, checklist));
  }
  return {
    id: run.id,
    objective: run.objective ?? "",
    scope: run.scope,
    constraints: run.constraints,
    acceptanceCriteria: toCriteria(run.acceptanceCriteria),
    dependsOnRunIds: toStringArray(run.dependsOnRunIds),
    status: deriveMissionStatus(phaseDetails.map((phase) => phase.status)),
    phases: phaseDetails,
  };
}

export async function getPhaseDetail(phaseId: string, db: PrismaClient): Promise<PhaseDetail | null> {
  const phase = (await db.workflowPhase.findUnique({ where: { id: phaseId } })) as RawPhase | null;
  if (!phase) return null;
  const checklist = (await db.workflowChecklistItem.findMany({
    where: { workflowPhaseId: phase.id },
    orderBy: { createdAt: "asc" },
  })) as RawChecklistItem[];
  return toPhaseDetail(phase, checklist);
}

export async function listOpenMissions(
  db: PrismaClient,
): Promise<Array<{ id: string; objective: string; status: MissionStatus }>> {
  const runs = await db.workflowRun.findMany({ where: { workflowType: { startsWith: "mission." } } });
  const result: Array<{ id: string; objective: string; status: MissionStatus }> = [];
  for (const run of runs) {
    const detail = await getMissionDetail(run.id, db);
    if (detail) result.push({ id: detail.id, objective: detail.objective, status: detail.status });
  }
  return result;
}

export async function transitionPhase(
  phaseId: string,
  to: PhaseStatus,
  opts: { blockedReason?: string },
  db: PrismaClient,
): Promise<void> {
  const phase = (await db.workflowPhase.findUnique({ where: { id: phaseId } })) as
    | { id: string; status: string; attempt: number; startedAt: Date | null; completedAt: Date | null }
    | null;
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const from = phase.status as PhaseStatus;
  assertLegalPhaseTransition(from, to);
  const now = new Date();
  await db.workflowPhase.update({
    where: { id: phaseId },
    data: {
      status: to,
      attempt: to === "IN_PROGRESS" ? phase.attempt + 1 : phase.attempt,
      blockedReason: to === "BLOCKED" ? opts.blockedReason ?? null : null,
      startedAt: to === "IN_PROGRESS" && !phase.startedAt ? now : phase.startedAt,
      completedAt: to === "COMPLETE" || to === "FAILED" ? now : phase.completedAt,
    },
  });
}

export async function updateChecklistItem(
  itemId: string,
  status: ChecklistItemStatus,
  evidenceRef: unknown,
  db: PrismaClient,
): Promise<void> {
  const item = (await db.workflowChecklistItem.findUnique({ where: { id: itemId } })) as
    | { id: string; workflowPhaseId: string; status: string; evidenceRef: unknown }
    | null;
  if (!item) throw new Error(`Checklist item not found: ${itemId}`);
  if (item.status === status) return;
  await db.workflowChecklistItem.update({
    where: { id: itemId },
    data: {
      status,
      evidenceRef: toJsonInput(evidenceRef ?? item.evidenceRef),
      completedAt: status === "DONE" || status === "SKIPPED" ? new Date() : null,
    },
  });
  await db.workflowPhase.update({
    where: { id: item.workflowPhaseId },
    data: { lastProgressAt: new Date() },
  });
}

export async function writeCheckpoint(
  params: {
    phaseId: string;
    workflowRunId: string;
    checkpointKey: string;
    state?: unknown;
    evidenceRefs?: unknown;
  },
  db: PrismaClient,
): Promise<{ id: string }> {
  const existingCount = await db.workflowCheckpoint.count({ where: { workflowRunId: params.workflowRunId } });
  const checkpoint = await db.workflowCheckpoint.create({
    data: {
      workflowRunId: params.workflowRunId,
      checkpointKey: params.checkpointKey,
      sequence: existingCount + 1,
      state: toJsonInput(params.state),
      evidenceRefs: toJsonInput(params.evidenceRefs),
    },
  });
  await db.workflowPhase.update({
    where: { id: params.phaseId },
    data: { lastProgressAt: new Date() },
  });
  return { id: checkpoint.id };
}

export async function recordPhaseDecision(
  params: {
    phaseId: string;
    workflowRunId: string;
    outcome: "ACCEPT" | "REJECT" | "BLOCK";
    reason?: string;
    evidenceRefs?: unknown;
  },
  db: PrismaClient,
): Promise<{ id: string }> {
  const decision = await db.agentDecision.create({
    data: {
      workflowRunId: params.workflowRunId,
      decisionType: "phase_acceptance",
      status: params.outcome === "ACCEPT" ? "accepted" : params.outcome === "REJECT" ? "rejected" : "blocked",
      decision: { phaseId: params.phaseId, outcome: params.outcome, reason: params.reason ?? null },
      evidenceRefs: toJsonInput(params.evidenceRefs),
    },
  });
  return { id: decision.id };
}
