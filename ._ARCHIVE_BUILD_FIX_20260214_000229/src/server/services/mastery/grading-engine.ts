export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * EWMA update:
 * next = prev + alpha*(gradeMastery - prev)
 * gradeMastery = gradePercent / 100
 */
export function computeNextMastery(opts: {
  previousMastery: number;
  gradePercent: number; // 0..100
  alpha?: number;       // default 0.35
}) {
  const alpha = typeof opts.alpha === "number" ? opts.alpha : 0.35;
  const prev = clamp01(opts.previousMastery ?? 0);
  const g = clamp01((opts.gradePercent ?? 0) / 100);
  return clamp01(prev + alpha * (g - prev));
}

export function masteryToLevel(mastery: number) {
  // Your MasteryRecord.level is Int and you're currently using 0..100 scale.
  return Math.round(clamp01(mastery) * 100);
}

export function letterToPercent(letter?: string | null) {
  if (!letter) return null;
  const L = String(letter).trim().toUpperCase();
  const map: Record<string, number> = {
    "A+": 98, "A": 95, "A-": 92,
    "B+": 88, "B": 85, "B-": 82,
    "C+": 78, "C": 75, "C-": 72,
    "D+": 68, "D": 65, "D-": 62,
    "F": 55,
  };
  return map[L] ?? null;
}
