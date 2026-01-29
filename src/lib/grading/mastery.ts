import { PrismaClient, EvidenceSourceType, MasteryMeasurementType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Phase-1 mastery calculation (simple + explainable):
 * - Convert a grade percent into masteryLevel (0..1)
 * - Write a new ObjectiveMasterySnapshot (append-only)
 * - Link the snapshot to the Grade via MasteryEvidence
 *
 * Later upgrades:
 * - weighted evidence types
 * - objective/skill mapping per assessment item
 * - Bayesian / EMA smoothing
 */
export async function recordMasteryFromGrade(params: {
  studentId: string;
  skillId: string;
  gradeId: string;
  percent: number;               // 0..100
  measurementType?: MasteryMeasurementType; // FORMATIVE/SUMMATIVE
  sourceType?: EvidenceSourceType;
  contextNote?: string;
  weight?: number;               // optional evidence weight
  measuredAt?: Date;
}) {
  const {
    studentId,
    skillId,
    gradeId,
    percent,
    measurementType = MasteryMeasurementType.FORMATIVE,
    sourceType = EvidenceSourceType.ASSESSMENT,
    contextNote,
    weight,
    measuredAt,
  } = params;

  const masteryLevel = Math.max(0, Math.min(1, percent / 100));

  return prisma.$transaction(async (tx) => {
    // 1) Create snapshot (append-only)
    const snapshot = await tx.objectiveMasterySnapshot.create({
      data: {
        studentId,
        skillId,
        masteryLevel,
        measuredAt: measuredAt ?? new Date(),
        measurementType,
        contextNote,
      },
    });

    // 2) Link evidence
    await tx.masteryEvidence.create({
      data: {
        snapshotId: snapshot.id,
        gradeId,
        sourceType,
        weight,
        recordedAt: new Date(),
      },
    });

    return snapshot;
  });
}

/**
 * Query helper: get time-series mastery for a student+skill
 */
export async function getMasteryTrajectory(params: {
  studentId: string;
  skillId: string;
  from?: Date;
  to?: Date;
}) {
  const { studentId, skillId, from, to } = params;

  return prisma.objectiveMasterySnapshot.findMany({
    where: {
      studentId,
      skillId,
      ...(from || to
        ? {
            measuredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { measuredAt: "asc" },
    include: { evidence: true },
  });
}
