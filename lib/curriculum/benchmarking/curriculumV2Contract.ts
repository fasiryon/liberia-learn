import type { DepthRelation, VerificationStatus } from "./types";
import type { AlignmentEvidence } from "./aiWaecAlignment";

/**
 * P2-C Phase 15: the structured handoff contract Curriculum V2 will consume.
 * This is a type + pure builder only -- Curriculum V2 itself is not
 * implemented here. buildCurriculumV2Contract takes plain data (already
 * queried by the caller) and assembles the contract; it never queries the
 * database itself, matching the rest of this module's style.
 */
export type CurriculumV2Contract = {
  moeObjective: {
    id: string;
    code: string;
    grade: number;
    subject: string;
    domain: string;
    topic: string;
    authoritativeWording: string;
    verificationStatus: VerificationStatus;
  };
  applicableExamFramework: {
    code: string;
    exam: string;
    level: string;
    examAliases: string[];
  } | null;
  waecSubjectApplicability: {
    subjectCode: string;
    required: boolean;
    subjectGroup: string | null;
  } | null;
  evidenceSpecificity: "TOPIC_LEVEL" | "SUBJECT_LEVEL" | "FRAMEWORK_LEVEL" | "NONE";
  verifiedBaselineDepth: DepthRelation | "UNKNOWN";
  /** Honest, human-readable list of what is NOT established by current evidence. Never left empty just to look complete. */
  unknownBaselineDetails: string[];
  liberiaLearnMasteryTarget: { code: string; statement: string } | null;
  liberiaLearnExtensionTarget: { code: string; statement: string } | null;
  prerequisiteRefs: string[];
  misconceptionRefs: string[];
  evidenceReferences: AlignmentEvidence[];
  sourceFreshness: VerificationStatus;
  /** e.g. a CurriculumBaselineAlignment.status value, or NOT_REVIEWED if no alignment row exists yet. */
  reviewState: string;
};

export function buildCurriculumV2Contract(input: {
  moeObjective: CurriculumV2Contract["moeObjective"];
  framework: CurriculumV2Contract["applicableExamFramework"];
  waecSubject: CurriculumV2Contract["waecSubjectApplicability"];
  baselineCompetency: {
    verificationStatus: VerificationStatus;
    /** Persisted AssessmentBaselineCompetency.evidenceSpecificity, when known. */
    evidenceSpecificity?: "FRAMEWORK_LEVEL" | "SUBJECT_LEVEL" | "TOPIC_LEVEL";
  } | null;
  evidence: AlignmentEvidence[];
  /**
   * The actual assessed depth relation for this exact moeObjective <->
   * baselineCompetency pairing (CurriculumBaselineAlignment.depthRelation or
   * an equivalent explicit depth record), when one exists. This is the ONLY
   * source verifiedBaselineDepth may come from -- it must never be inferred
   * from evidenceSpecificity or evidence presence, which answer a different
   * question ("what level of evidence exists") than "does LiberiaLearn meet
   * the baseline". Omit or pass null/undefined when no assessment exists yet.
   */
  assessedDepthRelation?: DepthRelation | null;
  masteryTarget: CurriculumV2Contract["liberiaLearnMasteryTarget"];
  extensionTarget: CurriculumV2Contract["liberiaLearnExtensionTarget"];
  prerequisiteRefs?: string[];
  misconceptionRefs?: string[];
  reviewState?: string;
}): CurriculumV2Contract {
  const hasTopicLevel = input.evidence.some(
    (item) => (item.authorityType === "WAEC_LIBERIA" || item.authorityType === "WAEC_REGIONAL") && item.evidenceSpecificity === "TOPIC_LEVEL",
  );
  const hasSubjectLevel = input.evidence.some(
    (item) => (item.authorityType === "WAEC_LIBERIA" || item.authorityType === "WAEC_REGIONAL") && item.evidenceSpecificity === "SUBJECT_LEVEL",
  );
  const evidenceSpecificity: CurriculumV2Contract["evidenceSpecificity"] =
    input.baselineCompetency?.evidenceSpecificity ??
    (hasTopicLevel ? "TOPIC_LEVEL" : hasSubjectLevel ? "SUBJECT_LEVEL" : input.evidence.length > 0 ? "FRAMEWORK_LEVEL" : "NONE");

  // Evidence specificity answers "what level of evidence exists"; it never
  // answers "does LiberiaLearn meet the baseline". verifiedBaselineDepth
  // reflects only an actual assessed depth relation, defaulting to UNKNOWN
  // when none exists -- even when TOPIC_LEVEL evidence is present.
  const verifiedBaselineDepth: CurriculumV2Contract["verifiedBaselineDepth"] = input.assessedDepthRelation ?? "UNKNOWN";

  const unknownBaselineDetails: string[] = [];
  if (verifiedBaselineDepth === "UNKNOWN") {
    unknownBaselineDetails.push(
      "No assessed baseline depth relation exists yet for this exact objective-to-competency pairing; exact expected depth is unknown, not assumed.",
    );
  }
  if (!input.masteryTarget) {
    unknownBaselineDetails.push("No LiberiaLearn mastery target has been authored for this objective yet.");
  }
  if (!input.extensionTarget) {
    unknownBaselineDetails.push("No LiberiaLearn extension target has been authored beyond this objective yet.");
  }

  return {
    moeObjective: input.moeObjective,
    applicableExamFramework: input.framework,
    waecSubjectApplicability: input.waecSubject,
    evidenceSpecificity,
    verifiedBaselineDepth,
    unknownBaselineDetails,
    liberiaLearnMasteryTarget: input.masteryTarget,
    liberiaLearnExtensionTarget: input.extensionTarget,
    prerequisiteRefs: input.prerequisiteRefs ?? [],
    misconceptionRefs: input.misconceptionRefs ?? [],
    evidenceReferences: input.evidence,
    sourceFreshness: input.baselineCompetency?.verificationStatus ?? input.moeObjective.verificationStatus,
    reviewState: input.reviewState ?? "NOT_REVIEWED",
  };
}

/**
 * P2-C Phase 16: the P5-A (source/evidence) handoff contract. Type + pure
 * mapper only -- P5-A itself is not implemented here.
 */
export type P5AHandoffContract = {
  sourceVersionId: string;
  sourceHash: string;
  validityStatus: "ACTIVE" | "STALE" | "SUPERSEDED";
  rightsStatus: string;
  revocationState: "ACTIVE" | "REVOKED" | "SUPERSEDED";
  staleMappingState: "FRESH" | "STALE" | "UNKNOWN";
};

export function buildP5AHandoffContract(input: {
  sourceVersionId: string;
  sourceHash: string;
  validityStatus: P5AHandoffContract["validityStatus"];
  rightsStatus: string;
  revoked: boolean;
  superseded: boolean;
}): P5AHandoffContract {
  return {
    sourceVersionId: input.sourceVersionId,
    sourceHash: input.sourceHash,
    validityStatus: input.validityStatus,
    rightsStatus: input.rightsStatus,
    revocationState: input.revoked ? "REVOKED" : input.superseded ? "SUPERSEDED" : "ACTIVE",
    staleMappingState: input.validityStatus === "STALE" ? "STALE" : input.validityStatus === "ACTIVE" ? "FRESH" : "UNKNOWN",
  };
}
