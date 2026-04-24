import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export type CurriculumFlagType = "FLAG_CURRICULUM_REVIEW" | "CONTENT_GAP_NOTICE";
export type CurriculumFlagStatus = "ACTIVE" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export type CurriculumFlagItem = {
  id: string;
  flagType: CurriculumFlagType;
  lessonId: string | null;
  schoolId: string | null;
  severity: string;
  sourceSignal: string;
  avgScore: number | null;
  retryRate: number | null;
  schoolCount: number;
  status: CurriculumFlagStatus;
  createdAt: Date;
};

type WeakLesson = {
  contentId: string;
  title: string;
  avgScore: number;
  attemptCount: number;
};

type ConceptGap = {
  subject: string;
  severity: "critical" | "severe" | "adequate";
};

const WEAK_LESSON_SCORE_THRESHOLD = 60;
const MIN_ATTEMPT_COUNT = 5;

function flagSeverity(avgScore: number): string {
  if (avgScore < 40) return "critical";
  if (avgScore < 55) return "high";
  return "medium";
}

export async function generateCurriculumFlags(
  weakLessons: WeakLesson[],
  conceptGaps: ConceptGap[],
  schoolId?: string | null
): Promise<void> {
  const flags: Array<{
    idempotencyKey: string;
    lessonId: string | null;
    schoolId: string | null;
    flagType: CurriculumFlagType;
    sourceSignal: string;
    severity: string;
    avgScore: number | null;
    schoolCount: number;
  }> = [];

  for (const lesson of weakLessons) {
    if (
      lesson.avgScore < WEAK_LESSON_SCORE_THRESHOLD &&
      lesson.attemptCount >= MIN_ATTEMPT_COUNT
    ) {
      const scopeKey = schoolId ? `${schoolId}:${lesson.contentId}` : `national:${lesson.contentId}`;
      flags.push({
        idempotencyKey: `FLAG_CURRICULUM_REVIEW:${scopeKey}`,
        lessonId: lesson.contentId,
        schoolId: schoolId ?? null,
        flagType: "FLAG_CURRICULUM_REVIEW",
        sourceSignal: "lesson.avg_score_below_threshold",
        severity: flagSeverity(lesson.avgScore),
        avgScore: lesson.avgScore,
        schoolCount: 1,
      });
    }
  }

  for (const gap of conceptGaps) {
    if (gap.severity === "critical" || gap.severity === "severe") {
      const scopeKey = schoolId ? `${schoolId}:${gap.subject}` : `national:${gap.subject}`;
      flags.push({
        idempotencyKey: `CONTENT_GAP_NOTICE:${scopeKey}`,
        lessonId: null,
        schoolId: schoolId ?? null,
        flagType: "CONTENT_GAP_NOTICE",
        sourceSignal: "curriculum.concept_gap",
        severity: gap.severity === "critical" ? "critical" : "high",
        avgScore: null,
        schoolCount: 1,
      });
    }
  }

  if (flags.length === 0) return;

  const existingKeys = await prisma.curriculumFlag
    .findMany({
      where: {
        idempotencyKey: { in: flags.map((f) => f.idempotencyKey) },
        status: { in: ["ACTIVE", "UNDER_REVIEW"] },
      },
      select: { idempotencyKey: true },
    })
    .then((rows) => new Set(rows.map((r) => r.idempotencyKey)));

  const newFlags = flags.filter((f) => !existingKeys.has(f.idempotencyKey));
  if (newFlags.length === 0) return;

  await prisma.curriculumFlag.createMany({
    data: newFlags.map((f) => ({
      id: randomUUID(),
      lessonId: f.lessonId,
      schoolId: f.schoolId,
      flagType: f.flagType,
      sourceSignal: f.sourceSignal,
      severity: f.severity,
      status: "ACTIVE",
      idempotencyKey: f.idempotencyKey,
      avgScore: f.avgScore,
      schoolCount: f.schoolCount,
    })),
    skipDuplicates: true,
  });
}

export async function getActiveCurriculumFlags(
  schoolId?: string | null
): Promise<CurriculumFlagItem[]> {
  const where = schoolId
    ? { status: "ACTIVE", schoolId }
    : { status: "ACTIVE" };

  const rows = await prisma.curriculumFlag.findMany({
    where,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  return rows.map((r) => ({
    id: r.id,
    flagType: r.flagType as CurriculumFlagType,
    lessonId: r.lessonId ?? null,
    schoolId: r.schoolId ?? null,
    severity: r.severity,
    sourceSignal: r.sourceSignal,
    avgScore: r.avgScore ?? null,
    retryRate: r.retryRate ?? null,
    schoolCount: r.schoolCount,
    status: r.status as CurriculumFlagStatus,
    createdAt: r.createdAt,
  }));
}

export async function resolveCurriculumFlag(
  flagId: string,
  resolvedByUserId: string
): Promise<void> {
  const flag = await prisma.curriculumFlag.update({
    where: { id: flagId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByUserId },
    select: { schoolId: true, flagType: true, lessonId: true },
  });

  logLearningEvent({
    eventType: "flag.curriculum.resolved",
    schoolId: flag.schoolId ?? undefined,
    actor: { type: "user", id: resolvedByUserId, role: "ADMIN" },
    target: { type: "curriculum_flag", id: flagId },
    metadata: { flagType: flag.flagType, lessonId: flag.lessonId },
  }).catch(() => null);
}

export async function getCurriculumFlagSummary(schoolId?: string | null): Promise<{
  totalActive: number;
  critical: number;
  high: number;
  medium: number;
  byType: Record<string, number>;
}> {
  const flags = await getActiveCurriculumFlags(schoolId);
  const byType: Record<string, number> = {};
  let critical = 0, high = 0, medium = 0;
  for (const f of flags) {
    byType[f.flagType] = (byType[f.flagType] ?? 0) + 1;
    if (f.severity === "critical") critical++;
    else if (f.severity === "high") high++;
    else medium++;
  }
  return { totalActive: flags.length, critical, high, medium, byType };
}
