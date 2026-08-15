import type {
  CurriculumReviewAuthority,
  CurriculumReviewPriorityBand,
  ReviewerCredentialType,
} from "@prisma/client";
import { P2B_RUBRIC_KEY, P2B_RUBRIC_VERSION } from "./rubric";

export const P2B_POLICY_KEY = "P2B_QUALIFIED_REVIEW";
export const P2B_POLICY_VERSION = 1;

const SENSITIVE_SUBJECTS = new Set(["HEALTH", "SAFETY", "LEGAL", "CIVICS", "HISTORY", "SOCIAL_STUDIES"]);

export type ReviewPolicyInput = {
  subject: string;
  grade: number;
  contentType: string;
  requestedAuthority: CurriculumReviewAuthority;
  riskBand: CurriculumReviewPriorityBand;
  riskScore?: number | null;
  riskReasons?: string[];
  nationalPublication?: boolean;
  waecAuthoritative?: boolean;
  waecBaselineAlignment?: boolean;
  importedOrLicensed?: boolean;
  sourceRightsRequired?: boolean;
  reinstatementAfterRevocation?: boolean;
  emergencyRevocation?: boolean;
  policyException?: boolean;
  provenanceComplete: boolean;
  evidenceCount?: number;
  now?: Date;
};

export type ReviewPolicyOutput = {
  policyKey: typeof P2B_POLICY_KEY;
  policyVersion: typeof P2B_POLICY_VERSION;
  rubricKey: typeof P2B_RUBRIC_KEY;
  rubricVersion: typeof P2B_RUBRIC_VERSION;
  priorityBand: CurriculumReviewPriorityBand;
  priorityScore: number;
  priorityReasons: string[];
  requiredAuthority: CurriculumReviewAuthority;
  requiredReviewCount: number;
  specialistCredentialTypes: ReviewerCredentialType[];
  dueAt: Date;
  slaMinutes: number;
  blindSecondReview: boolean;
  evidenceRequired: boolean;
  evidenceReasonCodes: string[];
  approvalBlocked: boolean;
};

const BAND_WEIGHT: Record<CurriculumReviewPriorityBand, number> = {
  CRITICAL: 4000,
  HIGH: 3000,
  STANDARD: 2000,
  LOW: 1000,
};

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
}

export function evaluateReviewPolicy(input: ReviewPolicyInput): ReviewPolicyOutput {
  if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > 12) {
    throw new Error("grade must be an integer from 1 through 12");
  }
  const now = input.now ?? new Date();
  const subject = input.subject.trim().toUpperCase();
  const sensitive = SENSITIVE_SUBJECTS.has(subject);
  const twoPerson =
    input.riskBand === "HIGH" ||
    input.riskBand === "CRITICAL" ||
    input.nationalPublication === true ||
    input.waecAuthoritative === true ||
    input.waecBaselineAlignment === true ||
    sensitive ||
    input.reinstatementAfterRevocation === true ||
    input.policyException === true;
  const requiredReviewCount = input.emergencyRevocation ? 1 : twoPerson ? 2 : 1;
  const requiredAuthority =
    input.nationalPublication || input.waecAuthoritative
      ? "MOE"
      : input.requestedAuthority;
  const specialistCredentialTypes: ReviewerCredentialType[] = [];
  if (input.waecAuthoritative) specialistCredentialTypes.push("WAEC_SUBJECT_REVIEW");
  if (input.waecBaselineAlignment) specialistCredentialTypes.push("STANDARDS_ALIGNMENT");
  if (input.importedOrLicensed) specialistCredentialTypes.push("LICENSED_SOURCE_REVIEW");
  if (input.sourceRightsRequired) specialistCredentialTypes.push("SOURCE_RIGHTS_VERIFICATION");
  if (["HEALTH", "SAFETY"].includes(subject)) specialistCredentialTypes.push("SAFETY_REVIEW");
  if (subject === "HEALTH") specialistCredentialTypes.push("HEALTH_REVIEW");
  if (subject === "LEGAL") specialistCredentialTypes.push("LEGAL_REVIEW");

  const evidenceReasonCodes: string[] = [];
  if (input.waecAuthoritative) evidenceReasonCodes.push("WAEC_AUTHORITATIVE");
  if (input.waecBaselineAlignment) evidenceReasonCodes.push("WAEC_BASELINE_ALIGNMENT");
  if (input.importedOrLicensed) evidenceReasonCodes.push("IMPORTED_OR_LICENSED_SOURCE");
  if (input.sourceRightsRequired) evidenceReasonCodes.push("SOURCE_RIGHTS");
  if (input.riskBand === "HIGH" || input.riskBand === "CRITICAL") evidenceReasonCodes.push("HIGH_RISK_FACTUAL_CLAIM");
  if (sensitive) evidenceReasonCodes.push("SENSITIVE_FACTUAL_CLAIM");
  const evidenceRequired = evidenceReasonCodes.length > 0;

  let slaMinutes: number;
  let dueAt: Date;
  if (input.riskBand === "CRITICAL") {
    slaMinutes = 240;
    dueAt = new Date(now.getTime() + slaMinutes * 60_000);
  } else if (input.riskBand === "HIGH") {
    slaMinutes = 1440;
    dueAt = new Date(now.getTime() + slaMinutes * 60_000);
  } else if (input.riskBand === "STANDARD") {
    slaMinutes = 5 * 24 * 60;
    dueAt = addBusinessDays(now, 5);
  } else {
    slaMinutes = 10 * 24 * 60;
    dueAt = addBusinessDays(now, 10);
  }

  const priorityReasons = [
    `RISK_BAND_${input.riskBand}`,
    ...(input.riskReasons ?? []),
    ...(input.nationalPublication ? ["NATIONAL_PUBLICATION"] : []),
    ...(input.waecAuthoritative ? ["WAEC_AUTHORITATIVE"] : []),
    ...(input.waecBaselineAlignment ? ["WAEC_BASELINE_ALIGNMENT"] : []),
    ...(sensitive ? ["SENSITIVE_SUBJECT"] : []),
    ...(!input.provenanceComplete ? ["PROVENANCE_INCOMPLETE"] : []),
    ...(evidenceRequired && (input.evidenceCount ?? 0) === 0 ? ["EVIDENCE_MISSING"] : []),
  ];
  const priorityScore =
    BAND_WEIGHT[input.riskBand] +
    Math.max(0, Math.min(999, input.riskScore ?? 0)) +
    (input.nationalPublication ? 100 : 0) +
    (input.waecAuthoritative ? 100 : 0) +
    (input.waecBaselineAlignment ? 75 : 0) +
    (sensitive ? 50 : 0) +
    (!input.provenanceComplete ? 75 : 0) +
    (evidenceRequired && (input.evidenceCount ?? 0) === 0 ? 75 : 0);

  return {
    policyKey: P2B_POLICY_KEY,
    policyVersion: P2B_POLICY_VERSION,
    rubricKey: P2B_RUBRIC_KEY,
    rubricVersion: P2B_RUBRIC_VERSION,
    priorityBand: input.riskBand,
    priorityScore,
    priorityReasons: Array.from(new Set(priorityReasons)),
    requiredAuthority,
    requiredReviewCount,
    specialistCredentialTypes: Array.from(new Set(specialistCredentialTypes)),
    dueAt,
    slaMinutes,
    blindSecondReview: requiredReviewCount === 2 && !input.emergencyRevocation,
    evidenceRequired,
    evidenceReasonCodes,
    approvalBlocked: evidenceRequired && (input.evidenceCount ?? 0) === 0,
  };
}
