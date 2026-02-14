export type GradableItemType =
  | "ASSESSMENT"
  | "ASSIGNMENT"
  | "LAB"
  | "PROJECT"
  | "ORAL"
  | "PARTICIPATION"
  | "PORTFOLIO"
  | "OTHER";

export type ScoringType = "POINTS" | "ANALYTIC_RUBRIC" | "HOLISTIC";

export type GradingMethod =
  | "TEACHER"
  | "AI_ASSISTED"
  | "PEER"
  | "SELF"
  | "COLLABORATIVE"
  | "EXTERNAL";

export type SubmissionType = "ONLINE" | "OFFLINE" | "AUDIO" | "PHOTO" | "TEXT" | "LINK";

export type LockState = "DRAFT" | "PUBLISHED" | "LOCKED" | "ARCHIVED";

export type ExcuseStatus = "NONE" | "EXCUSED" | "EXTENDED" | "PENDING_MAKEUP";

export interface ImprovementPolicy {
  mode: "NONE" | "BEST_OF_N" | "REPLACE_IF_IMPROVED" | "DROP_LOWEST_N";
  n?: number;
  replaceThresholdDelta?: number; // e.g. must improve by 5% to replace
}

export interface GradeCategoryWeight {
  category: string;
  weight: number; // 0..1
}

export interface GradePolicy {
  term: number;
  weights: GradeCategoryWeight[];
  latePolicy?: {
    enabled: boolean;
    perDayPenaltyPercent?: number; // e.g. 5 means -5% per late day
    maxPenaltyPercent?: number;    // cap
    graceDays?: number;
  };
}
