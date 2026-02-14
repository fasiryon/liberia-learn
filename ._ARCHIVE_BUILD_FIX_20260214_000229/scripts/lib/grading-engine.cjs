/* eslint-disable no-console */
function clamp01(n) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function percentToMastery(percent) {
  if (percent === null || percent === undefined) return 0;
  const p = Number(percent);
  if (Number.isNaN(p)) return 0;
  return p > 1 ? clamp01(p / 100) : clamp01(p);
}

// v1 smoothing
function computeNextMastery({ previousMastery, gradePercent, alpha = 0.35 }) {
  const prev = previousMastery ?? 0;
  const score = percentToMastery(gradePercent);
  const next = (prev * (1 - alpha)) + (score * alpha);
  return clamp01(next);
}

// map mastery 0..1 to level int (0..100)
function masteryToLevel(m) {
  return Math.round(clamp01(m) * 100);
}

module.exports = {
  clamp01,
  percentToMastery,
  computeNextMastery,
  masteryToLevel,
};
