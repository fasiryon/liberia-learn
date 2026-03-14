import type { MasteryGap } from "@/lib/adaptive/gapDetector";

export type DifficultyTier = "remedial" | "standard" | "stretch";

export type AttemptRecord = {
  score: number;
  completedAt: Date;
};

const TIERS: DifficultyTier[] = ["remedial", "standard", "stretch"];

function baseTierFromAverage(averageScore: number): DifficultyTier {
  if (averageScore < 0.4) return "remedial";
  if (averageScore < 0.7) return "standard";
  return "stretch";
}

function shiftTier(tier: DifficultyTier, offset: -1 | 1): DifficultyTier {
  const currentIndex = TIERS.indexOf(tier);
  const nextIndex = Math.max(0, Math.min(TIERS.length - 1, currentIndex + offset));
  return TIERS[nextIndex];
}

export function computeDifficultyTier(
  gap: MasteryGap,
  recentAttempts: AttemptRecord[]
): DifficultyTier {
  const baseTier = baseTierFromAverage(gap.averageScore);
  const lastThree = [...recentAttempts]
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, 3);

  if (lastThree.length < 3) {
    return baseTier;
  }

  if (lastThree.every((attempt) => attempt.score > 0.8)) {
    return shiftTier(baseTier, 1);
  }

  if (lastThree.every((attempt) => attempt.score < 0.4)) {
    return shiftTier(baseTier, -1);
  }

  return baseTier;
}
