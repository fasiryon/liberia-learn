import type { CurriculumReviewRecommendation } from "@prisma/client";
import {
  assertNoFabricatedExternalAuthorityClaim,
  validateAiWaecAlignment,
  type AlignmentEvidence,
} from "@/lib/curriculum/benchmarking/aiWaecAlignment";

export const AI_REVIEW_DIMENSIONS = [
  "standards_alignment",
  "factual_correctness",
  "age_appropriateness",
  "instructional_clarity",
  "assessment_alignment",
  "localization",
  "accessibility",
  "safety",
  "evidence_quality",
  "language_quality",
] as const;

type DimensionStatus = "PASS" | "CONCERN" | "FAIL" | "NOT_APPLICABLE";

export type ParsedAIReview = {
  recommendation: CurriculumReviewRecommendation;
  confidence: number;
  rationale: string;
  dimensions: Record<string, {
    status: DimensionStatus;
    severity: string;
    rationale: string;
    evidenceRefs: string[];
  }>;
  waecAlignment?: unknown;
  malformedReasons: string[];
};

export type WaecAlignmentContext = {
  moeObjectiveWording: string;
  baselineExpectation: string;
  evidence: AlignmentEvidence[];
};

export type DeterministicAIReviewValidation = {
  passed: boolean;
  approvalBlocked: boolean;
  reasons: string[];
  citedEvidenceRefs: string[];
  validatedWaecAlignment?: unknown;
};

const RECOMMENDATIONS = new Set(["APPROVE", "REJECT", "RETURN_FOR_REVISION", "ESCALATE"]);
const DIMENSION_STATUSES = new Set(["PASS", "CONCERN", "FAIL", "NOT_APPLICABLE"]);

export function parseAIReviewResult(raw: string): ParsedAIReview {
  const malformedReasons: string[] = [];
  let value: Record<string, unknown>;
  try {
    const decoded = JSON.parse(raw) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("object required");
    value = decoded as Record<string, unknown>;
  } catch {
    return {
      recommendation: "ESCALATE",
      confidence: 0,
      rationale: "AI review response was not valid structured JSON",
      dimensions: {},
      malformedReasons: ["MALFORMED_JSON"],
    };
  }

  const recommendation = RECOMMENDATIONS.has(String(value.recommendation))
    ? value.recommendation as CurriculumReviewRecommendation
    : "ESCALATE";
  if (!RECOMMENDATIONS.has(String(value.recommendation))) malformedReasons.push("MALFORMED_RECOMMENDATION");

  const rawConfidence = Number(value.confidence);
  const confidence = Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 100
    ? rawConfidence
    : 0;
  if (!Number.isFinite(rawConfidence) || rawConfidence < 0 || rawConfidence > 100) malformedReasons.push("MALFORMED_CONFIDENCE");

  const rationale = typeof value.rationale === "string" && value.rationale.trim()
    ? value.rationale.trim()
    : "AI review did not return a rationale";
  if (typeof value.rationale !== "string" || !value.rationale.trim()) malformedReasons.push("MALFORMED_RATIONALE");

  const rawDimensions = value.dimensions && typeof value.dimensions === "object" && !Array.isArray(value.dimensions)
    ? value.dimensions as Record<string, unknown>
    : {};
  if (!value.dimensions || typeof value.dimensions !== "object" || Array.isArray(value.dimensions)) {
    malformedReasons.push("MALFORMED_DIMENSIONS");
  }
  const dimensions: ParsedAIReview["dimensions"] = {};
  for (const key of AI_REVIEW_DIMENSIONS) {
    const rawDimension = rawDimensions[key];
    if (!rawDimension || typeof rawDimension !== "object" || Array.isArray(rawDimension)) {
      malformedReasons.push(`MALFORMED_DIMENSION:${key}`);
      continue;
    }
    const item = rawDimension as Record<string, unknown>;
    const evidenceRefs = Array.isArray(item.evidenceRefs) && item.evidenceRefs.every((ref) => typeof ref === "string" && ref.trim())
      ? item.evidenceRefs.map((ref) => String(ref).trim())
      : [];
    if (!DIMENSION_STATUSES.has(String(item.status))) malformedReasons.push(`MALFORMED_DIMENSION_STATUS:${key}`);
    if (typeof item.severity !== "string" || !item.severity.trim()) malformedReasons.push(`MALFORMED_DIMENSION_SEVERITY:${key}`);
    if (typeof item.rationale !== "string" || !item.rationale.trim()) malformedReasons.push(`MALFORMED_DIMENSION_RATIONALE:${key}`);
    if (!Array.isArray(item.evidenceRefs) || !item.evidenceRefs.every((ref) => typeof ref === "string" && ref.trim())) {
      malformedReasons.push(`MALFORMED_DIMENSION_EVIDENCE_REFS:${key}`);
    }
    dimensions[key] = {
      status: DIMENSION_STATUSES.has(String(item.status)) ? item.status as DimensionStatus : "CONCERN",
      severity: typeof item.severity === "string" ? item.severity.trim() : "unknown",
      rationale: typeof item.rationale === "string" ? item.rationale.trim() : "No rationale returned",
      evidenceRefs,
    };
  }

  return {
    recommendation,
    confidence,
    rationale,
    dimensions,
    waecAlignment: value.waecAlignment,
    malformedReasons,
  };
}

export function validateDeterministicAIReview(input: {
  parsed: ParsedAIReview;
  availableEvidence: Array<{ id: string; status: string }>;
  evidenceRequirements?: { required?: boolean; approvalBlocked?: boolean } | null;
  minimumConfidence: number;
  specialty: string;
  waecAlignmentContext?: WaecAlignmentContext | null;
}): DeterministicAIReviewValidation {
  const reasons = [...input.parsed.malformedReasons];
  const availableEvidenceIds = new Set(
    input.availableEvidence.filter((item) => item.status === "ACTIVE").map((item) => item.id),
  );
  const citedEvidenceRefs = [...new Set(
    Object.values(input.parsed.dimensions).flatMap((dimension) => dimension.evidenceRefs),
  )];
  for (const evidenceRef of citedEvidenceRefs) {
    if (!availableEvidenceIds.has(evidenceRef)) reasons.push(`FABRICATED_OR_INACTIVE_EVIDENCE_REF:${evidenceRef}`);
  }

  const authorityText = [
    input.parsed.rationale,
    ...Object.values(input.parsed.dimensions).map((dimension) => dimension.rationale),
  ].join("\n");
  try {
    assertNoFabricatedExternalAuthorityClaim(authorityText);
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : "AI_EXTERNAL_AUTHORITY_CLAIM_PROHIBITED");
  }

  const approving = input.parsed.recommendation === "APPROVE";
  if (approving && input.evidenceRequirements?.approvalBlocked) reasons.push("APPROVAL_BLOCKED_BY_EVIDENCE_POLICY");
  if (approving && input.evidenceRequirements?.required && availableEvidenceIds.size === 0) reasons.push("REQUIRED_EVIDENCE_MISSING");
  if (approving && citedEvidenceRefs.length === 0) reasons.push("APPROVAL_WITHOUT_CITED_EVIDENCE");
  if (approving && input.parsed.confidence < input.minimumConfidence) reasons.push("LOW_CONFIDENCE_APPROVAL");

  let validatedWaecAlignment: unknown;
  if (input.specialty === "WAEC_ALIGNMENT") {
    if (!input.waecAlignmentContext) {
      reasons.push("WAEC_ALIGNMENT_CONTEXT_REQUIRED");
    } else {
      try {
        validatedWaecAlignment = validateAiWaecAlignment({
          raw: input.parsed.waecAlignment,
          ...input.waecAlignmentContext,
        });
      } catch (error) {
        reasons.push(error instanceof Error ? error.message : "WAEC_ALIGNMENT_VALIDATION_FAILED");
      }
    }
  }

  return {
    passed: reasons.length === 0,
    approvalBlocked: approving && reasons.length > 0,
    reasons: [...new Set(reasons)],
    citedEvidenceRefs,
    ...(validatedWaecAlignment ? { validatedWaecAlignment } : {}),
  };
}

export function aiReviewDisagreementSignature(input: {
  recommendation: string | null;
  rubricResponses: unknown;
  aiReviewSnapshot?: unknown;
}): string {
  const dimensions = input.rubricResponses && typeof input.rubricResponses === "object" && !Array.isArray(input.rubricResponses)
    ? input.rubricResponses as Record<string, unknown>
    : {};
  const dimensionSignature = AI_REVIEW_DIMENSIONS.map((key) => {
    const dimension = dimensions[key] && typeof dimensions[key] === "object"
      ? dimensions[key] as Record<string, unknown>
      : {};
    return `${key}:${String(dimension.status ?? "MISSING")}:${String(dimension.severity ?? "MISSING")}`;
  }).join("|");
  const snapshot = input.aiReviewSnapshot && typeof input.aiReviewSnapshot === "object" && !Array.isArray(input.aiReviewSnapshot)
    ? input.aiReviewSnapshot as Record<string, unknown>
    : {};
  const waec = snapshot.validatedWaecAlignment && typeof snapshot.validatedWaecAlignment === "object"
    ? snapshot.validatedWaecAlignment as Record<string, unknown>
    : {};
  return `${input.recommendation ?? "MISSING"}|${dimensionSignature}|${String(waec.relationshipType ?? "")}|${String(waec.depthRelation ?? "")}`;
}
