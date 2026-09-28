import { createHash } from "crypto";
import { deterministicReleaseIdentity, type CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { createGovernedEvidence, toCanonicalMasteryEvidence, validateGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import type { InteractiveLabDefinition, LabState, LearningCheck } from "./types";

export const LAB_EVIDENCE_AUTHORITY_VERSION = "interactive-lab-evidence-authority/1.0.0" as const;
export type LabEvidenceKind = "OBJECT_SELECTED" | "STATE_MANIPULATED" | "LEARNING_CHECK_RESPONSE" | "PROCEDURE_SUCCESS" | "PROCEDURE_FAILURE" | "MISCONCEPTION_SIGNAL" | "HINT_USED" | "RETRY" | "EXPLANATION_SUBMITTED" | "LAB_COMPLETED";
export type LabEvidenceDisposition = "CANONICAL" | "PROVISIONAL" | "RAW_OBSERVATION";

export type LabLearningCheckAuthority = Readonly<{
  contractVersion: typeof LAB_EVIDENCE_AUTHORITY_VERSION;
  labId: string;
  labVersion: string;
  objectiveId: string;
  conceptId: string;
  releaseId: string;
  releaseIdentity: string;
  learningCheckId: string;
  evidenceKind: LabEvidenceKind;
  acceptedState: Readonly<Record<string, unknown>>;
  resultSemantics: "CORRECT_IF_SERVER_VALIDATED" | "OBSERVATION_ONLY";
  evidencePolicyRef: string;
  disposition: LabEvidenceDisposition;
  canonicalActivity?: Readonly<{ activityId: string; activityVersion: string; evidenceType: "PRACTICE" | "DIAGNOSTIC" }>;
}>;

export const SOLIDS_LEARNING_CHECK_AUTHORITY: readonly LabLearningCheckAuthority[] = Object.freeze([
  { contractVersion: LAB_EVIDENCE_AUTHORITY_VERSION, labId: "g4-solid-figures", labVersion: "2.1.0", objectiveId: "moe-math-g4-s2-p6-geometry-and-statistics-obj5", conceptId: "g4-solid-figures-identification", releaseId: "lr-moe-g4-math-solids-2026.1", releaseIdentity: "pending-review", learningCheckId: "select-sphere", evidenceKind: "LEARNING_CHECK_RESPONSE", acceptedState: { selectedObjectId: "sphere" }, resultSemantics: "CORRECT_IF_SERVER_VALIDATED", evidencePolicyRef: "pending-g4-solids-evidence-policy", disposition: "PROVISIONAL" },
  { contractVersion: LAB_EVIDENCE_AUTHORITY_VERSION, labId: "g4-solid-figures", labVersion: "2.1.0", objectiveId: "moe-math-g4-s2-p6-geometry-and-statistics-obj5", conceptId: "g4-solid-figures-identification", releaseId: "lr-moe-g4-math-solids-2026.1", releaseIdentity: "pending-review", learningCheckId: "rotate-cube", evidenceKind: "STATE_MANIPULATED", acceptedState: { objectId: "cube", minRotationRadians: 0.5 }, resultSemantics: "CORRECT_IF_SERVER_VALIDATED", evidencePolicyRef: "pending-g4-solids-evidence-policy", disposition: "PROVISIONAL" },
  { contractVersion: LAB_EVIDENCE_AUTHORITY_VERSION, labId: "g4-solid-figures", labVersion: "2.1.0", objectiveId: "moe-math-g4-s2-p6-geometry-and-statistics-obj5", conceptId: "g4-solid-figures-identification", releaseId: "lr-moe-g4-math-solids-2026.1", releaseIdentity: "pending-review", learningCheckId: "cube-vertices", evidenceKind: "LEARNING_CHECK_RESPONSE", acceptedState: { objectId: "cube", vertexCount: 8 }, resultSemantics: "CORRECT_IF_SERVER_VALIDATED", evidencePolicyRef: "pending-g4-solids-evidence-policy", disposition: "PROVISIONAL" },
]);

export function findLabCheckAuthority(labId: string, labVersion: string, learningCheckId: string): LabLearningCheckAuthority | null {
  return SOLIDS_LEARNING_CHECK_AUTHORITY.find((candidate) => candidate.labId === labId && candidate.labVersion === labVersion && candidate.learningCheckId === learningCheckId) ?? null;
}

export function validateLabAuthority(definition: InteractiveLabDefinition, check: LearningCheck, authority: LabLearningCheckAuthority): void {
  if (authority.contractVersion !== LAB_EVIDENCE_AUTHORITY_VERSION) throw new Error("lab_authority_contract_unsupported");
  if (authority.labId !== definition.id || authority.labVersion !== definition.version || authority.learningCheckId !== check.id) throw new Error("lab_authority_identity_mismatch");
  if (authority.objectiveId !== check.objectiveId || authority.conceptId !== check.conceptId || !definition.objectiveIds.includes(authority.objectiveId) || !definition.conceptIds.includes(authority.conceptId)) throw new Error("lab_authority_learning_binding_invalid");
  if (authority.releaseId !== definition.releaseBinding.releaseId || authority.releaseIdentity !== definition.releaseBinding.releaseIdentity) throw new Error("lab_authority_release_binding_invalid");
}

export type LabEvidenceAdaptation = Readonly<{ disposition: LabEvidenceDisposition; governedEvidence: GovernedEvidence; canonicalEvidence?: ReturnType<typeof toCanonicalMasteryEvidence>; reason: string }>;

export function adaptLabEvidence(input: { definition: InteractiveLabDefinition; check: LearningCheck; evidence: GovernedEvidence; authority?: LabLearningCheckAuthority | null; release?: CurriculumOntologyRelease | null }): LabEvidenceAdaptation {
  validateGovernedEvidence(input.evidence);
  const authority = input.authority ?? findLabCheckAuthority(input.definition.id, input.definition.version, input.check.id);
  if (!authority) return { disposition: "RAW_OBSERVATION", governedEvidence: input.evidence, reason: "No governed lab learning-check mapping exists." };
  validateLabAuthority(input.definition, input.check, authority);
  if (authority.disposition !== "CANONICAL" || !authority.canonicalActivity || !input.release || input.release.id !== authority.releaseId || deterministicReleaseIdentity(input.release) !== authority.releaseIdentity) return { disposition: authority.disposition === "RAW_OBSERVATION" ? "RAW_OBSERVATION" : "PROVISIONAL", governedEvidence: input.evidence, reason: "Mapping is prepared but its release/activity is not approved and published." };
  if (!input.evidence.performance.correct || input.evidence.performance.selectedAnswerIndex === undefined) return { disposition: "PROVISIONAL", governedEvidence: input.evidence, reason: "Canonical scored evidence requires a server-validated result." };
  const canonicalCandidate = createGovernedEvidence({ ...input.evidence, activity: authority.canonicalActivity, evidenceType: authority.canonicalActivity.evidenceType, objective: { conceptId: authority.conceptId, objectiveId: authority.objectiveId }, curriculum: { ontologyReleaseId: input.release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(input.release) } });
  return { disposition: "CANONICAL", governedEvidence: canonicalCandidate, canonicalEvidence: toCanonicalMasteryEvidence(canonicalCandidate, input.release), reason: "Explicit governed lab mapping converted to the existing scored-item mastery semantics." };
}

export function deterministicLabEventId(idempotencyKey: string): string { return `lab-event-${createHash("sha256").update(idempotencyKey).digest("hex")}`; }
