import { appendCanonicalMasteryUpdate } from "@/lib/learning-state/masteryWriter";
import type { CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import type { InteractiveLabDefinition, LearningCheck } from "./types";
import { adaptLabEvidence, type LabEvidenceAdaptation } from "./governance";

export async function routeLabEvidenceToExistingMasteryPath(input: { definition: InteractiveLabDefinition; check: LearningCheck; evidence: GovernedEvidence; release?: CurriculumOntologyRelease | null; studentId: string }): Promise<LabEvidenceAdaptation & { mastery?: Awaited<ReturnType<typeof appendCanonicalMasteryUpdate>> }> {
  const adaptation = adaptLabEvidence(input);
  if (adaptation.disposition !== "CANONICAL" || !adaptation.canonicalEvidence || !input.release) return adaptation;
  const result = await appendCanonicalMasteryUpdate({ release: input.release, schoolId: input.evidence.schoolId, studentId: input.studentId, studentUserId: input.evidence.learner.studentUserId, sessionId: input.evidence.strength.independenceKey, itemId: adaptation.canonicalEvidence.itemId, itemVersion: adaptation.canonicalEvidence.itemVersion, selectedAnswerIndex: adaptation.canonicalEvidence.selectedAnswerIndex, occurredAt: adaptation.canonicalEvidence.occurredAt, admission: { decision: "ACCEPTED", reason: "explicit_governed_lab_mapping", bindingId: adaptation.canonicalEvidence.bindingId, policyVersion: adaptation.canonicalEvidence.evidencePolicyVersion, toolPolicyVersion: adaptation.canonicalEvidence.toolPolicyVersion, legacyMasteryProjectionAllowed: false }, governedEvidence: adaptation.governedEvidence });
  return { ...adaptation, mastery: result };
}
