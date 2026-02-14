import { PrismaClient } from "@prisma/client";
import { computeNextMastery, masteryToLevel, letterToPercent } from "./grading-engine";

const prisma = new PrismaClient();

/**
 * Applies a Grade -> ObjectiveMasterySnapshot + MasteryEvidence + upserts MasteryRecord.
 * This is the backend "truth" function you can call from routes, jobs, hooks, etc.
 */
export async function applyGradeToMastery(args: {
  studentId: string;
  skillId: string;
  gradeId: string;
  measurementType?: "FORMATIVE" | "SUMMATIVE";
  alpha?: number; // EWMA smoothing
  contextNote?: string;
}) {
  const { studentId, skillId, gradeId } = args;

  const measurementType = args.measurementType ?? "FORMATIVE";
  const alpha = typeof args.alpha === "number" ? args.alpha : 0.35;

  // Try minimal select first, but fallback to no-select if schema shifts.
  let grade: any;
  try {
    grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: {
        id: true,
        percent: true,
        letter: true,
        computedAt: true,
        studentId: true,
        classId: true,
      },
    });
  } catch {
    grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  }

  if (!grade) throw new Error(`Grade not found: ${gradeId}`);

  // Determine gradePercent
  let gradePercent: number | null = null;

  if (grade.percent !== null && grade.percent !== undefined) {
    gradePercent = Number(grade.percent);
  } else {
    gradePercent = letterToPercent(grade.letter);
  }

  if (gradePercent === null || Number.isNaN(Number(gradePercent))) {
    gradePercent = 75; // demo-safe fallback; you can tighten later
  }

  // Determine previous mastery
  let previousMastery = 0;

  const lastSnap = await prisma.objectiveMasterySnapshot.findFirst({
    where: { studentId, skillId },
    orderBy: { measuredAt: "desc" },
    select: { masteryLevel: true },
  });

  if (lastSnap) {
    previousMastery = lastSnap.masteryLevel;
  } else {
    const mr = await prisma.masteryRecord.findFirst({
      where: { studentId, skillId },
      select: { level: true },
    });
    if (mr) previousMastery = (mr.level ?? 0) / 100;
  }

  const nextMastery = computeNextMastery({ previousMastery, gradePercent, alpha });
  const nextLevel = masteryToLevel(nextMastery);

  const snapshot = await prisma.objectiveMasterySnapshot.create({
    data: {
      studentId,
      skillId,
      masteryLevel: nextMastery,
      measuredAt: new Date(),
      measurementType,
      contextNote: args.contextNote ?? `Auto snapshot from Grade ${gradeId}`,
    },
    select: { id: true, measuredAt: true, masteryLevel: true },
  });

  const evidence = await prisma.masteryEvidence.create({
    data: {
      snapshotId: snapshot.id,
      gradeId,
      sourceType: "ASSESSMENT",
      weight: 1.0,
      recordedAt: new Date(),
      note: "Auto evidence from grade",
    },
    select: { id: true },
  });

  const masteryRecord = await prisma.masteryRecord.upsert({
    where: { studentId_skillId: { studentId, skillId } },
    update: { level: nextLevel, lastAssessedAt: new Date() },
    create: { studentId, skillId, level: nextLevel, lastAssessedAt: new Date() },
    select: { id: true, level: true, lastAssessedAt: true },
  });

  return {
    gradeId,
    gradePercent,
    previousMastery,
    nextMastery,
    nextLevel,
    snapshot,
    evidence,
    masteryRecord,
  };
}
