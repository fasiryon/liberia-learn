/**
 * lib/adaptive/updateMastery.ts  — NR-14B Phase 3
 *
 * Rolling EMA mastery tracker.
 *
 * A skill is mastered when:
 *   score >= MASTERY_SCORE (0.80)  AND
 *   consecutiveCorrect >= MASTERY_STREAK (3)
 *
 * Score uses exponential moving average (alpha=0.3):
 *   newScore = prevScore + α × (outcome − prevScore)
 *   where outcome = 1 (correct) or 0 (wrong)
 *
 * masteredAt is sticky: once set it doesn't clear on later dips
 * (mastery represents demonstrated understanding, not current state).
 */

import { prisma } from "@/lib/db";

export const MASTERY_SCORE = 0.80;
export const MASTERY_STREAK = 3;
export const EMA_ALPHA = 0.3;

export type MasteryUpdate = {
  score: number;
  consecutiveCorrect: number;
  mastered: boolean;
  masteredAt: Date | null;
};

/**
 * Record a quiz answer and update the student's AdaptiveMasteryRecord.
 *
 * @param studentId  Student.id
 * @param skillKey   "SUBJECT:GN:unitId" — derive with lessonSkillKey()
 * @param correct    Whether the answer was correct
 */
export async function recordAnswer(input: {
  studentId: string;
  skillKey: string;
  correct: boolean;
}): Promise<MasteryUpdate> {
  const { studentId, skillKey, correct } = input;

  const existing = await prisma.adaptiveMasteryRecord.findUnique({
    where: { studentId_skillKey: { studentId, skillKey } },
    select: {
      score: true,
      consecutiveCorrect: true,
      masteredAt: true,
    },
  });

  // Rolling EMA
  const prevScore = existing?.score ?? 0;
  const outcome = correct ? 1 : 0;
  const newScore = prevScore + EMA_ALPHA * (outcome - prevScore);

  // Streak — resets to 0 on any wrong answer
  const prevStreak = existing?.consecutiveCorrect ?? 0;
  const newStreak = correct ? prevStreak + 1 : 0;

  // Mastery gate: score AND streak both must qualify
  const meetsGate = newScore >= MASTERY_SCORE && newStreak >= MASTERY_STREAK;

  // masteredAt is sticky (once mastered, stays mastered even if score dips)
  const prevMasteredAt = existing?.masteredAt ?? null;
  const newMasteredAt = meetsGate ? (prevMasteredAt ?? new Date()) : prevMasteredAt;

  await prisma.adaptiveMasteryRecord.upsert({
    where: { studentId_skillKey: { studentId, skillKey } },
    create: {
      studentId,
      skillKey,
      score: newScore,
      consecutiveCorrect: newStreak,
      masteredAt: newMasteredAt,
    },
    update: {
      score: newScore,
      consecutiveCorrect: newStreak,
      masteredAt: newMasteredAt,
    },
  });

  return {
    score: newScore,
    consecutiveCorrect: newStreak,
    mastered: meetsGate || prevMasteredAt !== null,
    masteredAt: newMasteredAt,
  };
}

/**
 * Derive NR-14B skillKey from a CurriculumContent ID.
 * Inline version (no DB call if caller already has the data).
 */
export function buildSkillKey(params: {
  subject: string;
  grade: number;
  unitId?: string | null;
  contentId: string;
}): string {
  const unit = params.unitId ?? params.contentId;
  return `${params.subject}:G${params.grade}:${unit}`;
}
