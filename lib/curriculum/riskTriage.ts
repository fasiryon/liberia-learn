// lib/curriculum/riskTriage.ts
//
// Risk-based triage between the existing mechanical quality gates
// (regenerationQualityGate.ts / promotionPass.ts / the inline gate in
// bulk-approve-published.ts) and a final approval status. Only called from
// automated/script-driven approval paths - never from the human-driven
// approve/reject routes (app/api/admin/curriculum/approve|reject/route.ts,
// app/api/admin/ops/curriculum-review/route.ts). See
// docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md.
import { prisma } from "@/lib/db";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";
import { logger } from "@/lib/logger";
import { APPROVED_STATUSES } from "@/lib/curriculum/coverageShared";
import { notifyRiskReviewers } from "@/lib/curriculum/riskTriageNotify";
import { logAudit } from "@/lib/audit";
import { provenanceWritersEnabled, updateCurriculumContent } from "@/lib/curriculum/mutations/repository";

export type GradeBand = "G1_3" | "G4_6" | "G7_PLUS";

export const GRADE_BAND_RISK: Record<GradeBand, number> = {
  G1_3: 3,
  G4_6: 2,
  G7_PLUS: 0,
};

// Subjects scored as sensitive. Deliberately limited to the two subjects that
// actually exist in CurriculumContent.subject values today (see
// lib/curriculum/coverageShared.ts SUBJECTS) - CIVICS and SOCIAL_STUDIES.
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

/** Pure, deterministic, no I/O - see design doc's computeRiskScore section. */
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

export async function isFirstOfKindCell(grade: number, subject: string): Promise<boolean> {
  const count = await prisma.curriculumContent.count({
    where: {
      contentType: "lesson",
      grade,
      subject: subject.trim().toUpperCase(),
      status: { in: APPROVED_STATUSES },
    },
  });
  return count === 0;
}

export async function getFlaggedCountInWindow(): Promise<number> {
  const since = new Date(Date.now() - BUDGET_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return prisma.curriculumContent.count({
    where: {
      payload: { path: ["riskFlagged"], equals: true },
      updatedAt: { gte: since },
    },
  });
}

/** Live backlog count for the "N lessons awaiting your review" page badge. */
export async function countRiskFlaggedAwaitingReview(): Promise<number> {
  return prisma.curriculumContent.count({
    where: {
      status: "NEEDS_REVIEW",
      payload: { path: ["riskFlagged"], equals: true },
    },
  });
}

export type TriageCandidate = {
  contentId: string;
  grade: number;
  subject: string;
  payload: Record<string, any>;
  /** Existing caller metadata that is valid only after approval. */
  approvalMetadata?: Record<string, any>;
  wordCount: number;
  minWordCount: number;
};

export type TriageResult =
  | { action: "flagged"; contentId: string; riskScore: number; riskReasons: string[] }
  | {
      action: "approved";
      contentId: string;
      riskScore: number;
      riskReasons: string[];
      budgetExceeded: boolean;
    };

/**
 * Orchestrates one candidate through risk scoring, the weekly review budget,
 * and the final DB write. Called only from automated/script-driven approval
 * paths - see the module header comment. `approvedStatus` lets each caller
 * keep its own existing "approved" status string ("published" for
 * bulk-approve-published.ts, "APPROVED" for promote-enriched-lessons.ts).
 */
export async function triageAndApprove(
  candidate: TriageCandidate,
  actorLabel: string,
  approvedStatus: string
): Promise<TriageResult> {
  const isFirstOfKind = await isFirstOfKindCell(candidate.grade, candidate.subject);
  const { score, reasons } = computeRiskScore({
    grade: candidate.grade,
    subject: candidate.subject,
    isFirstOfKind,
    wordCount: candidate.wordCount,
    minWordCount: candidate.minWordCount,
  });

  const worthFlagging = isWorthFlagging(score);
  let overBudget = false;

  if (worthFlagging) {
    try {
      const flaggedCount = await getFlaggedCountInWindow();
      overBudget = flaggedCount >= WEEKLY_REVIEW_BUDGET;
    } catch (error) {
      logger.warn("[riskTriage] budget check failed, failing closed to flagged", {
        contentId: candidate.contentId,
        error,
      });
      overBudget = false;
    }
  }

  // Capacity is an operational signal only. Risk never falls because the
  // weekly human-review budget is exhausted.
  const shouldFlag = worthFlagging;
  if (worthFlagging && overBudget) {
    logger.warn("[riskTriage] weekly review budget exhausted, keeping high-risk candidate queued", {
      contentId: candidate.contentId,
      riskScore: score,
      riskReasons: reasons,
    });
  }

  if (!provenanceWritersEnabled()) {
    if (shouldFlag) {
      await updateCurriculumContent(
        { contentId: candidate.contentId },
        {
          status: "NEEDS_REVIEW",
          payload: {
            ...candidate.payload,
            riskFlagged: true,
            riskScore: score,
            riskReasons: reasons,
          } as any,
        },
        {
          revisionKind: "METADATA_CHANGE",
          originKind: "LEGACY_UNKNOWN",
          actorLabel,
          auditAction: "curriculum.risk.flagged",
        },
      );
      await logAudit({
        action: "curriculum.risk.flagged",
        resourceType: "curriculum",
        resourceId: candidate.contentId,
        details: { riskScore: score, riskReasons: reasons },
      });
      await notifyRiskReviewers(candidate.contentId, score, reasons).catch((error) => {
        logger.warn("[riskTriage] reviewer notification failed", { contentId: candidate.contentId, error });
      });
      return { action: "flagged", contentId: candidate.contentId, riskScore: score, riskReasons: reasons };
    }
    await updateCurriculumContent(
      { contentId: candidate.contentId },
      {
        status: approvedStatus,
        payload: {
          ...candidate.payload,
          ...(candidate.approvalMetadata ?? {}),
          approvalStatus: "APPROVED",
          riskScore: score,
          riskReasons: reasons,
        } as any,
      },
      {
        revisionKind: "METADATA_CHANGE",
        originKind: "LEGACY_UNKNOWN",
        actorLabel,
        auditAction: "curriculum.risk.autoapproved",
      },
    );
    await logAudit({
      action: "curriculum.risk.autoapproved",
      resourceType: "curriculum",
      resourceId: candidate.contentId,
      details: { riskScore: score, riskReasons: reasons, budgetExceeded: overBudget },
    });
    return {
      action: "approved",
      contentId: candidate.contentId,
      riskScore: score,
      riskReasons: reasons,
      budgetExceeded: overBudget,
    };
  }

  if (shouldFlag) {
    await appendCurriculumGovernanceEvent({
      contentId: candidate.contentId,
      eventType: "RISK_ASSESSED",
      actorType: "SYSTEM",
      actorLabel,
      riskScore: score,
      riskReasons: reasons,
      idempotencyKey: `risk:${candidate.contentId}:${score}:${candidate.payload.version ?? "current"}`,
    });
    await appendCurriculumGovernanceEvent({
      contentId: candidate.contentId,
      eventType: "RETURNED_FOR_REVIEW",
      actorType: "SYSTEM",
      actorLabel,
      reason: "Risk policy requires human review",
      reviewAuthority: "PLATFORM",
      riskScore: score,
      riskReasons: reasons,
      idempotencyKey: `risk-return:${candidate.contentId}:${score}:${candidate.payload.version ?? "current"}`,
    });
    await notifyRiskReviewers(candidate.contentId, score, reasons).catch((error) => {
      logger.warn("[riskTriage] reviewer notification failed", {
        contentId: candidate.contentId,
        error,
      });
    });
    return { action: "flagged", contentId: candidate.contentId, riskScore: score, riskReasons: reasons };
  }

  await appendCurriculumGovernanceEvent({
    contentId: candidate.contentId,
    eventType: "RISK_ASSESSED",
    actorType: "SYSTEM",
    actorLabel,
    riskScore: score,
    riskReasons: reasons,
    idempotencyKey: `risk:${candidate.contentId}:${score}:${candidate.payload.version ?? "current"}`,
  });
  await appendCurriculumGovernanceEvent({
    contentId: candidate.contentId,
    eventType: "APPROVED",
    actorType: "SYSTEM",
    actorLabel,
    approvalBasis: "AUTOMATED_RISK_POLICY",
    reviewAuthority: "PLATFORM",
    riskScore: score,
    riskReasons: reasons,
    idempotencyKey: `risk-approve:${candidate.contentId}:${score}:${candidate.payload.version ?? "current"}`,
  });
  return {
    action: "approved",
    contentId: candidate.contentId,
    riskScore: score,
    riskReasons: reasons,
    budgetExceeded: overBudget,
  };
}
