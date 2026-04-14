import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type JsonObject = Record<string, unknown>;

function toJson(value?: JsonObject | null): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

export type AppendMasterySnapshotInput = {
  studentId: string;
  schoolId?: string | null;
  subject: string;
  strandKey?: string | null;
  sourceProfileId?: string | null;
  sourceAttemptId?: string | null;
  sourceEventId?: string | null;
  snapshotType?: string | null;
  currentScore?: number | null;
  baselineScore?: number | null;
  proficiencyState?: string | null;
  masteryState?: string | null;
  sustainabilityIndex?: number | null;
  decayRate?: number | null;
  aiRelianceRate?: number | null;
  hybridScore?: number | null;
  growthDelta?: number | null;
  metadata?: JsonObject | null;
};

export async function appendMasterySnapshot(input: AppendMasterySnapshotInput) {
  const previous = await prisma.masterySnapshot.findFirst({
    where: {
      studentId: input.studentId,
      subject: input.subject,
      strandKey: input.strandKey ?? null,
    },
    orderBy: { capturedAt: "desc" },
    select: { id: true },
  });

  return prisma.masterySnapshot.create({
    data: {
      studentId: input.studentId,
      schoolId: input.schoolId ?? null,
      subject: input.subject,
      strandKey: input.strandKey ?? null,
      sourceProfileId: input.sourceProfileId ?? null,
      sourceAttemptId: input.sourceAttemptId ?? null,
      previousSnapshotId: previous?.id ?? null,
      snapshotType: input.snapshotType ?? "progress_refresh",
      sourceEventId: input.sourceEventId ?? null,
      currentScore: input.currentScore ?? null,
      baselineScore: input.baselineScore ?? null,
      proficiencyState: input.proficiencyState ?? null,
      masteryState: input.masteryState ?? null,
      sustainabilityIndex: input.sustainabilityIndex ?? null,
      decayRate: input.decayRate ?? null,
      aiRelianceRate: input.aiRelianceRate ?? null,
      hybridScore: input.hybridScore ?? null,
      growthDelta: input.growthDelta ?? null,
      metadata: toJson(input.metadata),
    },
  });
}

export type AppendDerivedStudentProgressInput = {
  studentId: string;
  schoolId?: string | null;
  subject: string;
  strandKey?: string | null;
  sourceProfileId?: string | null;
  sourceAttemptId?: string | null;
  sourceSnapshotId?: string | null;
  sourceChainId?: string | null;
  derivationType?: string | null;
  progressVersion?: string | null;
  currentScore?: number | null;
  baselineScore?: number | null;
  growthDelta?: number | null;
  hybridScore?: number | null;
  sustainabilityIndex?: number | null;
  decayRate?: number | null;
  aiRelianceRate?: number | null;
  proficiencyState?: string | null;
  masteryState?: string | null;
  metadata?: JsonObject | null;
};

export async function appendDerivedStudentProgress(input: AppendDerivedStudentProgressInput) {
  const chainWhere = {
    studentId: input.studentId,
    status: "open",
    ...(input.schoolId ? { schoolId: input.schoolId } : {}),
  };

  const misconceptionWhere = {
    studentId: input.studentId,
    status: "active",
    ...(input.sourceAttemptId ? { assessmentAttemptId: input.sourceAttemptId } : {}),
  };

  const [openInterventionChainCount, misconceptionCount] = await Promise.all([
    prisma.interventionChain.count({ where: chainWhere }),
    prisma.misconceptionTag.count({ where: misconceptionWhere }),
  ]);

  return prisma.derivedStudentProgress.create({
    data: {
      studentId: input.studentId,
      schoolId: input.schoolId ?? null,
      subject: input.subject,
      strandKey: input.strandKey ?? null,
      sourceProfileId: input.sourceProfileId ?? null,
      sourceAttemptId: input.sourceAttemptId ?? null,
      sourceSnapshotId: input.sourceSnapshotId ?? null,
      sourceChainId: input.sourceChainId ?? null,
      derivationType: input.derivationType ?? "mastery_refresh",
      progressVersion: input.progressVersion ?? null,
      currentScore: input.currentScore ?? null,
      baselineScore: input.baselineScore ?? null,
      growthDelta: input.growthDelta ?? null,
      hybridScore: input.hybridScore ?? null,
      sustainabilityIndex: input.sustainabilityIndex ?? null,
      decayRate: input.decayRate ?? null,
      aiRelianceRate: input.aiRelianceRate ?? null,
      proficiencyState: input.proficiencyState ?? null,
      masteryState: input.masteryState ?? null,
      misconceptionCount,
      openInterventionChainCount,
      metadata: toJson(input.metadata),
    },
  });
}
