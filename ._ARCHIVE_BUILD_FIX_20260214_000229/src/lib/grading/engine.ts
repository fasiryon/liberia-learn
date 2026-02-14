import { GradePolicy } from "./types";

export function computePercent(scorePoints: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  const pct = (scorePoints / maxPoints) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function letterFromPercent(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

/**
 * Compute weighted grade from category buckets.
 * buckets = { "Tests": 88.4, "Homework": 92.1, ... } in percent
 * policy.weights = [{category:"Tests", weight:0.4}, ...]
 */
export function computeWeightedGrade(
  buckets: Record<string, number>,
  policy: GradePolicy
): { percent: number; letter: string } {
  let total = 0;
  let wsum = 0;

  for (const w of policy.weights) {
    const v = buckets[w.category];
    if (typeof v === "number") {
      total += v * w.weight;
      wsum += w.weight;
    }
  }

  const percent = wsum > 0 ? total / wsum : 0;
  return { percent, letter: letterFromPercent(percent) };
}
