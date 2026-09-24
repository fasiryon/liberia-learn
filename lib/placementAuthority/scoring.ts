/**
 * Server-side placement scoring. Pure functions over server-scored items; the
 * client never supplies correctness, score, band, or grade. The grade mapping
 * is the placement.grade.v1 table formerly in /api/placement/calculate-grade.
 */
import { getPlacementBand, placementBandLabels, type PlacementBand } from "@/lib/placement";

export const PLACEMENT_ASSESSMENT_VERSION = "placement.server.v1";
export const PLACEMENT_SCORING_VERSION = "placement.grade.v1";
export const PLACEMENT_MAX_ITEMS = 10;
export const PLACEMENT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const PLACEMENT_START_DIFFICULTY = 3;

export type ScoredItem = { difficulty: number; isCorrect: boolean };

export type PlacementScore = {
  correctAnswers: number;
  totalQuestions: number;
  accuracyRate: number;
  weightedAccuracy: number;
  averageDifficulty: number;
  recommendedGrade: number;
  band: PlacementBand;
  levelLabel: string;
  confidence: "high" | "medium" | "low";
  difficultyRange: { min: number; max: number };
};

/** Adaptive step: harder after a correct answer, easier after a miss (1..5). */
export function nextDifficulty(previous: { difficulty: number; isCorrect: boolean } | null): number {
  if (!previous) return PLACEMENT_START_DIFFICULTY;
  if (previous.isCorrect) return Math.min(5, previous.difficulty + 1);
  return Math.max(1, previous.difficulty - 1);
}

export function recommendGrade(weightedAccuracy: number, avgDifficulty: number): number {
  if (weightedAccuracy >= 90) {
    if (avgDifficulty >= 4.5) return 12;
    if (avgDifficulty >= 4) return 11;
    if (avgDifficulty >= 3.5) return 10;
    if (avgDifficulty >= 3) return 9;
    if (avgDifficulty >= 2.5) return 8;
    if (avgDifficulty >= 2) return 7;
    return 6;
  }
  if (weightedAccuracy >= 80) {
    if (avgDifficulty >= 4) return 10;
    if (avgDifficulty >= 3.5) return 9;
    if (avgDifficulty >= 3) return 8;
    if (avgDifficulty >= 2.5) return 7;
    if (avgDifficulty >= 2) return 6;
    return 5;
  }
  if (weightedAccuracy >= 70) {
    if (avgDifficulty >= 4) return 9;
    if (avgDifficulty >= 3) return 8;
    if (avgDifficulty >= 2.5) return 7;
    if (avgDifficulty >= 2) return 6;
    return 5;
  }
  if (weightedAccuracy >= 60) {
    if (avgDifficulty >= 3) return 7;
    if (avgDifficulty >= 2.5) return 6;
    if (avgDifficulty >= 2) return 5;
    return 4;
  }
  if (avgDifficulty >= 2.5) return 5;
  if (avgDifficulty >= 2) return 4;
  if (avgDifficulty >= 1.5) return 3;
  return 2;
}

export function scorePlacement(items: ScoredItem[]): PlacementScore {
  if (items.length === 0) {
    throw Object.assign(new Error("No scored responses"), { status: 409 });
  }
  const totalQuestions = items.length;
  const correctAnswers = items.filter((item) => item.isCorrect).length;
  const accuracyRate = (correctAnswers / totalQuestions) * 100;

  let weightedScore = 0;
  let totalWeight = 0;
  for (const item of items) {
    const weight = item.difficulty || 1;
    totalWeight += weight;
    if (item.isCorrect) weightedScore += weight;
  }
  const weightedAccuracy = totalWeight ? (weightedScore / totalWeight) * 100 : 0;
  const averageDifficulty = items.reduce((sum, item) => sum + (item.difficulty || 1), 0) / totalQuestions;
  const variance =
    items.reduce((sum, item) => sum + Math.pow((item.difficulty || 1) - averageDifficulty, 2), 0) / totalQuestions;
  const band = getPlacementBand(correctAnswers, totalQuestions);

  return {
    correctAnswers,
    totalQuestions,
    accuracyRate: Math.round(accuracyRate),
    weightedAccuracy: Math.round(weightedAccuracy),
    averageDifficulty,
    recommendedGrade: recommendGrade(weightedAccuracy, averageDifficulty),
    band,
    levelLabel: placementBandLabels[band],
    confidence: variance < 0.5 ? "high" : variance < 1.5 ? "medium" : "low",
    difficultyRange: {
      min: Math.min(...items.map((item) => item.difficulty || 1)),
      max: Math.max(...items.map((item) => item.difficulty || 1)),
    },
  };
}
