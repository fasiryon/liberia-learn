import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import type { ActivityDefinitionV1 } from "@/lib/activity-definition/v1/types";
import type { AssessmentDefinitionV2, AssessmentFormV2, AssessmentItemV2, ProtectedScoringSpec } from "@/lib/assessment/v2/types";
import type { AgentIdentity } from "@/lib/curriculum/excellence/instructionalReviewer";
import type { BlueprintRef, FactoryRole, UnitBlueprint } from "./blueprint";

export type DocumentCandidate = { kind: "DOCUMENT"; title: string; sections: { heading: string; text: string }[]; textAlternative: string; keyboardPath: string; offlineInstructions: string; references: string[] };
export type AssessmentCandidate = { kind: "ASSESSMENT"; definition: AssessmentDefinitionV2; form: AssessmentFormV2; items: AssessmentItemV2[]; specs: ProtectedScoringSpec[] };
export type ResourcePayload = DocumentCandidate | { kind: "LESSON"; candidate: CandidateLessonV2 } | { kind: "ACTIVITY"; definition: ActivityDefinitionV1 } | AssessmentCandidate;
export type ResourceDraft = { id: string; version: string; payload: ResourcePayload };
export type FactoryArtifact = ResourceDraft & {
  blueprint: BlueprintRef; role: FactoryRole; author: AgentIdentity;
  dependencies: { id: string; version: string; contentHash: string }[];
  contentHash: string;
};
export type QualityReport = {
  failures: string[];
  humanRequired: string[];
  releaseBlockers: string[];
  criteria: { criterionId: string; check: string; evidenceRequired: string; status: "NOT_EVALUATED" }[];
  assessmentBlueprint: ReturnType<typeof import("@/lib/curriculum/excellence/assessmentBlueprint").evaluateAssessmentBlueprint>;
  isLearningEvidence: false;
};
export type FactoryEvent = {
  sequence: number; role: FactoryRole; attempt: number;
  status: "STARTED" | "RETRY_REQUIRED" | "SUCCEEDED" | "FAILED" | "REVISION_REQUIRED" | "REVIEW_PENDING";
  inputHash: string; outputHashes: string[]; error: string | null; previousHash: string | null; eventHash: string;
};
export type ExecutorInput = {
  blueprint: UnitBlueprint; dependencies: readonly FactoryArtifact[]; attempt: number;
  previousFailures: readonly string[]; quality: QualityReport | null;
};
export type FactoryExecutors = Record<FactoryRole, (input: ExecutorInput) => Promise<ResourceDraft[]>>;
export type FactoryResult = {
  status: "FAILED" | "REVISION_REQUIRED" | "AWAITING_HUMAN_REVIEW";
  blueprint: UnitBlueprint; artifacts: FactoryArtifact[]; events: FactoryEvent[]; quality: QualityReport;
  reviewerIndependence: { independent: boolean; reasons: readonly string[] } | null;
};
