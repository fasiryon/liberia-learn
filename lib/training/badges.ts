/**
 * lib/training/badges.ts
 *
 * Pure badge computation helpers for the Training Center.
 *
 * A badge is earned when ALL modules at a given level are complete.
 * Badges are not persisted in the DB for V1. They are derived from
 * TrainingProgress on each request.  This keeps the schema minimal and
 * avoids synchronisation issues.
 *
 * SSR-safe: no window / localStorage access.
 */

import { MODULES_BY_LEVEL } from "@/lib/training/modules";
import type { ModuleProgressRecord } from "@/lib/training/progress";

export type Badge = {
  /** Stable identifier used in telemetry events. */
  name: string;
  level: 1 | 2 | 3;
  /** Human-readable label shown in the UI. */
  label: string;
  emoji: string;
};

export const LEVEL_BADGES: Record<1 | 2 | 3, Badge> = {
  1: { name: "level_1_training_badge", level: 1, label: "Level 1 Training Badge", emoji: "🥉" },
  2: { name: "level_2_training_badge", level: 2, label: "Level 2 Training Badge", emoji: "🥈" },
  3: { name: "level_3_training_badge", level: 3, label: "Level 3 Training Badge", emoji: "🏅" },
};

/** Returns true when every module in the given level has status=complete. */
export function isLevelComplete(
  level: 1 | 2 | 3,
  progress: ModuleProgressRecord[]
): boolean {
  const completedIds = new Set(
    progress.filter((p) => p.status === "complete").map((p) => p.moduleId)
  );
  return MODULES_BY_LEVEL[level].every((m) => completedIds.has(m.id));
}

/** Returns the array of badges the teacher has earned, ordered by level. */
export function computeEarnedBadges(progress: ModuleProgressRecord[]): Badge[] {
  return ([1, 2, 3] as const).flatMap((level) =>
    isLevelComplete(level, progress) ? [LEVEL_BADGES[level]] : []
  );
}
