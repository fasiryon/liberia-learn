import { z } from "zod";
import { buildPrompt, getPrompt } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { COGNITIVE_DEMAND_TAXONOMY_VERSION } from "./types";

const AUTHORITATIVE_HOSTS = new Set(["moe.gov.lr", "www.moe.gov.lr", "waecliberia.org.lr", "www.waecliberia.org.lr", "waec.org", "www.waec.org"]);
const FORBIDDEN_AUTHORITY_CLAIMS = [
  /waec[ -]approved/i,
  /moe[ -]approved/i,
  /officially endorsed/i,
  /waec partnership/i,
  /waec licensed/i,
];

export const AiWaecAlignmentSchema = z.object({
  relationshipType: z.enum(["DIRECT", "SUPPORTING", "PREREQUISITE", "PARTIAL", "ENRICHMENT", "NOT_ALIGNED", "UNKNOWN"]),
  coverage: z.enum(["NONE", "PARTIAL", "FULL"]),
  depthRelation: z.enum(["BELOW_BASELINE", "MEETS_BASELINE", "ABOVE_BASELINE", "SIGNIFICANTLY_ABOVE_BASELINE", "NOT_COMPARABLE", "UNKNOWN"]),
  cognitiveDimensions: z.array(z.enum(["RECALL", "COMPREHENSION", "PROCEDURAL_FLUENCY", "APPLICATION", "ANALYSIS", "REASONING", "EVALUATION", "CREATION", "TRANSFER", "PROBLEM_MODELING"])).min(1),
  rationale: z.string().min(40),
  objectiveEvidenceTerms: z.array(z.string().min(3)).min(2),
  baselineEvidenceTerms: z.array(z.string().min(3)).min(2),
  evidenceRefs: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  overfitToExamMechanics: z.boolean(),
  prerequisiteGaps: z.array(z.string()),
  authorityLabel: z.literal("AI_ASSESSED_ALIGNMENT"),
  externalApprovalClaimed: z.literal(false),
});

export type AiWaecAlignment = z.infer<typeof AiWaecAlignmentSchema> & {
  taxonomyVersion: typeof COGNITIVE_DEMAND_TAXONOMY_VERSION;
  promptKey: string;
  promptVersion: string;
  promptHash: string;
  model: string;
  generationCorrelationId?: string;
};

export type AlignmentEvidence = {
  id: string;
  authorityType: "LIBERIA_MOE" | "WAEC_LIBERIA" | "WAEC_REGIONAL" | "GOVERNMENT" | "OTHER_VERIFIED";
  canonicalUrl: string;
  sourceVersionId: string;
  locator: string;
  excerpt: string;
  verificationStatus: "VERIFIED" | "PARTIAL" | "UNVERIFIED" | "STALE" | "SOURCE_MISSING" | "RIGHTS_LIMITED";
};

function normalizeTerms(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

function validatesEvidenceTerms(terms: string[], sourceText: string): boolean {
  const sourceTerms = normalizeTerms(sourceText);
  return terms.filter((term) => sourceTerms.has(term.toLowerCase())).length >= 2;
}

export function assertAuthoritativeAlignmentEvidence(evidence: AlignmentEvidence[]): void {
  if (evidence.length === 0) throw new Error("ALIGNMENT_EVIDENCE_REQUIRED");
  for (const item of evidence) {
    const url = new URL(item.canonicalUrl);
    if (!AUTHORITATIVE_HOSTS.has(url.hostname.toLowerCase())) throw new Error("ALIGNMENT_SOURCE_NOT_AUTHORITATIVE");
    if (["UNVERIFIED", "STALE", "SOURCE_MISSING"].includes(item.verificationStatus)) {
      throw new Error(`ALIGNMENT_SOURCE_NOT_CURRENT:${item.id}`);
    }
    if (!item.locator.trim() || !item.excerpt.trim() || !item.sourceVersionId.trim()) {
      throw new Error(`ALIGNMENT_EVIDENCE_INCOMPLETE:${item.id}`);
    }
  }
}

export function validateAiWaecAlignment(input: {
  raw: unknown;
  moeObjectiveWording: string;
  baselineExpectation: string;
  evidence: AlignmentEvidence[];
}): z.infer<typeof AiWaecAlignmentSchema> {
  assertAuthoritativeAlignmentEvidence(input.evidence);
  const result = AiWaecAlignmentSchema.parse(input.raw);
  if (FORBIDDEN_AUTHORITY_CLAIMS.some((claim) => claim.test(result.rationale))) {
    throw new Error("AI_EXTERNAL_AUTHORITY_CLAIM_PROHIBITED");
  }
  if (!validatesEvidenceTerms(result.objectiveEvidenceTerms, input.moeObjectiveWording)) {
    throw new Error("TITLE_ONLY_OR_UNGROUNDED_OBJECTIVE_MATCH");
  }
  if (!validatesEvidenceTerms(result.baselineEvidenceTerms, input.baselineExpectation)) {
    throw new Error("TITLE_ONLY_OR_UNGROUNDED_BASELINE_MATCH");
  }
  const permittedEvidenceIds = new Set(input.evidence.map((item) => item.id));
  if (result.evidenceRefs.some((id) => !permittedEvidenceIds.has(id))) {
    throw new Error("AI_ALIGNMENT_FABRICATED_EVIDENCE_REF");
  }
  return result;
}

export async function assessWaecBaselineAlignment(input: {
  moeObjectiveCode: string;
  moeObjectiveWording: string;
  baselineCompetencyCode: string;
  baselineExpectation: string;
  evidence: AlignmentEvidence[];
  curriculumRevisionId?: string | null;
  schoolId?: string | null;
  userId?: string | null;
}): Promise<AiWaecAlignment> {
  assertAuthoritativeAlignmentEvidence(input.evidence);
  const prompt = getPrompt("curriculum.waecBaselineAlignment.system");
  const completion = await routedCompletion({
    messages: [
      { role: "system", content: buildPrompt(prompt.key) },
      {
        role: "user",
        content: buildPrompt("curriculum.waecBaselineAlignment.user", {
          moeObjectiveCode: input.moeObjectiveCode,
          moeObjectiveWording: input.moeObjectiveWording,
          baselineCompetencyCode: input.baselineCompetencyCode,
          baselineExpectation: input.baselineExpectation,
          evidenceJson: JSON.stringify(input.evidence),
        }),
      },
    ],
    responseFormat: "json",
    maxTokens: 900,
    aiUsage: {
      route: "curriculum.waecBaselineAlignment",
      feature: "curriculum",
      requestType: "waec_baseline_alignment",
      schoolId: input.schoolId,
      userId: input.userId,
      contentId: input.curriculumRevisionId,
      promptKey: prompt.key,
      promptVersion: prompt.version,
      promptHash: prompt.hash,
      metadata: { authorityLabel: "AI_ASSESSED_ALIGNMENT", externalApprovalClaimed: false },
    },
  });
  const parsed = validateAiWaecAlignment({
    raw: JSON.parse(completion.content),
    moeObjectiveWording: input.moeObjectiveWording,
    baselineExpectation: input.baselineExpectation,
    evidence: input.evidence,
  });
  return {
    ...parsed,
    taxonomyVersion: COGNITIVE_DEMAND_TAXONOMY_VERSION,
    promptKey: prompt.key,
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    model: completion.model,
    generationCorrelationId: completion.generationCorrelationId,
  };
}

export type AlignmentReviewRole = "SUBJECT_MATTER" | "WAEC_ALIGNMENT" | "CURRICULUM_PEDAGOGY" | "ADJUDICATOR";

export function buildAlignmentReviewTopology(input: {
  criticality: "CRITICAL" | "HIGH" | "STANDARD" | "OPTIONAL";
  confidence: number;
  relationshipType: z.infer<typeof AiWaecAlignmentSchema>["relationshipType"];
  nationalImpact: boolean;
}): { independentRoles: AlignmentReviewRole[]; adjudicatorOnDisagreement: boolean; p2bPolicyFlag: "waecBaselineAlignment" } {
  const highRisk = input.nationalImpact || input.criticality === "CRITICAL" || input.criticality === "HIGH" || input.confidence < 0.75 || ["PARTIAL", "UNKNOWN"].includes(input.relationshipType);
  return {
    independentRoles: highRisk
      ? ["SUBJECT_MATTER", "WAEC_ALIGNMENT", "CURRICULUM_PEDAGOGY"]
      : ["SUBJECT_MATTER", "WAEC_ALIGNMENT"],
    adjudicatorOnDisagreement: true,
    p2bPolicyFlag: "waecBaselineAlignment",
  };
}

export function needsAlignmentAdjudication(
  assessments: Array<{ relationshipType: string; depthRelation: string; recommendation: string }>,
): boolean {
  if (assessments.length < 2) return false;
  return new Set(assessments.map((item) => `${item.relationshipType}:${item.depthRelation}:${item.recommendation}`)).size > 1;
}
