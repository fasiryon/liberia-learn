// lib/curriculum/riskTriage.ts
//
// Risk-based triage between the existing mechanical quality gates
// (regenerationQualityGate.ts / promotionPass.ts / the inline gate in
// bulk-approve-published.ts) and a final approval status. Only called from
// automated/script-driven approval paths — never from the human-driven
// approve/reject routes (app/api/admin/curriculum/approve|reject/route.ts,
// app/api/admin/ops/curriculum-review/route.ts). See
// docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { APPROVED_STATUSES } from "@/lib/curriculum/coverageShared";
import { notifyRiskReviewers } from "@/lib/curriculum/riskTriageNotify";

export type GradeBand = "G1_3" | "G4_6" | "G7_PLUS";

export const GRADE_BAND_RISK: Record<GradeBand, number> = {
  G1_3: 3,
  G4_6: 2,
  G7_PLUS: 0,
};

// Subjects scored as sensitive. Deliberately limited to the two subjects that
// actually exist in CurriculumContent.subject values today (see
// lib/curriculum/coverageShared.ts SUBJECTS) — CIVICS and SOCIAL_STUDIES.
export const SENSITIVE_SUBJECTS = new Set(["CIVICS", "SOCIAL_STUDIES"]);
export const SUBJECT_SENSITIVITY_SCORE = 2;
export const FIRST_OF_KIND_SCORE = 3;
// A candidate scores gate-margin risk when its word count is within this
// multiple of the pipeline's own minimum (e.g. 800 * 1.15 = 920).
export const GATE_MARGIN_THRESHOLD = 1.15;
export const GATE_MARGIN_SCORE = 2;
// Minimum total score to be worth flagging for human review at all.
export const FLAG_THRESHOLD = 4;
// Global rolling weekly cap on flagged lessons, enforced platform-wide (not
// per script/run) so this stays realistic once multiple pipelines call in.
export const WEEKLY_REVIEW_BUDGET = 8;
export const BUDGET_WINDOW_DAYS = 7;

export function gradeBandOf(grade: number): GradeBand {
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  return "G7_PLUS";
}

export type RiskFactorInput = {
  grade: number;
  subject: string;
  isFirstOfKind: boolean;
  wordCount: number;
  minWordCount: number;
};

export type RiskScoreResult = {
  score: number;
  reasons: string[];
};

/** Pure, deterministic, no I/O — see design doc's computeRiskScore section. */
export function computeRiskScore(input: RiskFactorInput): RiskScoreResult {
  let score = 0;
  const reasons: string[] = [];

  const band = gradeBandOf(input.grade);
  const gradeRisk = GRADE_BAND_RISK[band];
  if (gradeRisk > 0) {
    score += gradeRisk;
    reasons.push(`grade_band_${band.toLowerCase()}`);
  }

  const subjectKey = input.subject.trim().toUpperCase();
  if (SENSITIVE_SUBJECTS.has(subjectKey)) {
    score += SUBJECT_SENSITIVITY_SCORE;
    reasons.push(`sensitive_subject_${subjectKey.toLowerCase()}`);
  }

  if (input.isFirstOfKind) {
    score += FIRST_OF_KIND_SCORE;
    reasons.push("first_of_kind_cell");
  }

  if (input.minWordCount > 0 && input.wordCount <= input.minWordCount * GATE_MARGIN_THRESHOLD) {
    score += GATE_MARGIN_SCORE;
    reasons.push("borderline_quality_gate_margin");
  }

  return { score, reasons };
}

export function isWorthFlagging(score: number): boolean {
  return score >= FLAG_THRESHOLD;
}
