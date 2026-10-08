/**
 * Curriculum V2 — structured learning experience contract.
 *
 * Two shapes, deliberately separate:
 *
 *   CandidateLessonV2   what a generator (LLM or human author) may propose: instructional
 *                       content only. It carries no approval, release, publication,
 *                       mastery, scoring or answer-key fields; the strict parser rejects them.
 *
 *   CurriculumLessonV2  the server-assembled artifact: the candidate plus objectives,
 *                       ontology, release identity, lab links, provenance and governance
 *                       metadata, all resolved from trusted, pinned authoring context.
 *
 * The artifact is always a DRAFT that requires exact-revision human review. Nothing here
 * approves, publishes, releases, scores, writes mastery or chooses a next lesson.
 * Phase A runtime contracts (lib/learner-experience) are reused, not duplicated: scene
 * types, age bands, link shape and evidence types come from there.
 */
import type { GovernedEvidenceType } from "@/lib/learning-evidence/evidenceContract";
import type { LearningExperienceLink } from "@/lib/learner-experience/links";
import type { AgeBand, SceneType } from "@/lib/learner-experience/types";

export const CURRICULUM_LESSON_V2_CONTRACT = "curriculum-lesson-v2/1.0.0" as const;
export const CANDIDATE_LESSON_V2_CONTRACT = "candidate-lesson-v2/1.0.0" as const;

/** Bounded sizes (Codex P2-2). The 350-word scene cap is a ceiling, not a target. */
export const V2_LIMITS = Object.freeze({
  candidateBytes: 120_000,
  scenes: { min: 3, max: 20 },
  sceneWords: 350,
  explanationWordsAdvisory: 180,
  stringChars: 2_400,
  keyPoints: 8,
  itemsPerScene: 8,
  optionsPerItem: 6,
  stepsPerDiagram: 10,
  hintsPerScene: 4,
  misconceptions: 12,
  labCandidates: 3,
  assessmentRequests: 4,
});

/** Why a scene exists. Scenes are chosen for instructional purpose, never split by length. */
export const INSTRUCTIONAL_PURPOSES = [
  "HOOK_PHENOMENON", "STATE_OBJECTIVE", "ACTIVATE_PRIOR_KNOWLEDGE", "EXPLAIN_CONCEPT", "MODEL_WORKED_EXAMPLE",
  "GUIDED_PRACTICE", "INDEPENDENT_PRACTICE", "CHECK_UNDERSTANDING", "ADDRESS_MISCONCEPTION", "PREDICT",
  "INVESTIGATE", "APPLY", "REFLECT", "REVIEW", "ASSESS_MASTERY",
] as const;
export type InstructionalPurpose = (typeof INSTRUCTIONAL_PURPOSES)[number];

/**
 * Interactions a lesson may request. Only some are renderable by Lesson Player V2 today
 * (see runtimeCapabilities.ts); the rest are declared, reviewable intents that must carry an
 * objective-preserving fallback — never silently flattened into multiple choice.
 */
export const INTERACTION_KINDS = [
  "NONE", "DIAGRAM_REVEAL", "SINGLE_CHOICE", "MULTI_SELECT", "NUMERIC", "MATCHING", "ORDERING",
  "DIAGRAM_LABELING", "DRAG_DROP", "FREE_RESPONSE", "SIMULATION_OBSERVATION", "LAB_LAUNCH", "ASSESSMENT_HANDOFF",
] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

/** Offline requirement of a scene, mapped onto Phase A FULL / DEGRADED / ONLINE_ONLY. */
export const OFFLINE_MODES = ["FULL_OFFLINE", "CACHED_ASSET_REQUIRED", "ONLINE_ENHANCED", "FALLBACK_REQUIRED"] as const;
export type OfflineMode = (typeof OFFLINE_MODES)[number];

/** A fallback is a renderable experience, not a sentence: it must still teach the objective. */
export const FALLBACK_KINDS = ["TEXT_WALKTHROUGH", "PAPER_ACTIVITY", "DIAGRAM_REVEAL", "SINGLE_CHOICE", "FREE_RESPONSE"] as const;
export type FallbackKind = (typeof FALLBACK_KINDS)[number];

export const MEDIA_KINDS = ["DIAGRAM", "IMAGE", "MAP", "TIMELINE", "ANIMATION", "NARRATION", "VIDEO", "INTERACTIVE_MODEL"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const MEDIA_REQUIREMENTS = ["MEDIA_REQUIRED", "MEDIA_OPTIONAL", "TEXT_FALLBACK"] as const;
export type MediaRequirement = (typeof MEDIA_REQUIREMENTS)[number];

/** Phase C seams: descriptive only. They never grant mastery, next action, remediation or learner state. */
export const PEDAGOGY_STRATEGIES = [
  "CONCRETE_PICTORIAL_ABSTRACT", "WORKED_EXAMPLE_FADING", "RETRIEVAL_PRACTICE", "STRUCTURED_PROBLEM_SOLVING",
  "INQUIRY", "REFLECTION", "GUIDED_TO_INDEPENDENT", "DIRECT_INSTRUCTION",
] as const;
export type PedagogyStrategy = (typeof PEDAGOGY_STRATEGIES)[number];
export const REPRESENTATIONS = ["CONCRETE", "PICTORIAL", "ABSTRACT", "VERBAL", "MIXED"] as const;
export type Representation = (typeof REPRESENTATIONS)[number];
export const SCAFFOLD_LEVELS = ["FULL", "PARTIAL", "MINIMAL", "NONE"] as const;
export type ScaffoldLevel = (typeof SCAFFOLD_LEVELS)[number];

export const RESPONSE_TYPES = ["SELECTED_OPTION", "TEXT", "NUMBER", "ORDER", "MATCHES", "LABELS", "LAB_OBSERVATION", "ASSESSMENT_RESPONSE"] as const;
export type ResponseType = (typeof RESPONSE_TYPES)[number];

export type CandidateOption = Readonly<{ id: string; text: string; feedback: string }>;
/**
 * Formative items may carry the option the learner is expected to choose, for instant local
 * feedback (Phase A design). Only CHECK_UNDERSTANDING / PRACTICE scenes may; mastery never does.
 */
export type CandidateFormativeItem = Readonly<{ id: string; prompt: string; options: readonly CandidateOption[]; formativeKey: Readonly<{ expectedOptionId: string }> }>;

export type CandidateInteraction =
  | Readonly<{ kind: "NONE" }>
  | Readonly<{ kind: "DIAGRAM_REVEAL"; steps: readonly Readonly<{ id: string; label: string; description: string }>[] }>
  | Readonly<{ kind: "SINGLE_CHOICE"; items: readonly CandidateFormativeItem[] }>
  | Readonly<{ kind: "FREE_RESPONSE"; prompts: readonly Readonly<{ id: string; prompt: string; minLength: number }>[] }>
  | Readonly<{ kind: "LAB_LAUNCH"; labCandidateId: string }>
  | Readonly<{ kind: "ASSESSMENT_HANDOFF"; assessmentRequestId: string }>
  | Readonly<{ kind: "MULTI_SELECT" | "NUMERIC" | "MATCHING" | "ORDERING" | "DIAGRAM_LABELING" | "DRAG_DROP" | "SIMULATION_OBSERVATION"; prompt: string; elements: readonly string[] }>;

export type CandidateFallback = Readonly<{ kind: FallbackKind; content: string; objectivePreserved: boolean }>;

export type CandidateMedia = Readonly<{ id: string; kind: MediaKind; requirement: MediaRequirement; description: string; altText: string; transcript?: string }>;

export type CandidateEvidence =
  | Readonly<{ kind: "NONE" }>
  | Readonly<{
      kind: "FORMATIVE_OBSERVATION" | "LAB_OBSERVATION" | "REFLECTION" | "MASTERY_RESPONSE";
      evidenceType: GovernedEvidenceType;
      /** Explicit response → objective mapping (Codex P2-5), one entry per response the scene collects. */
      responses: readonly Readonly<{ responseKey: string; objectiveId: string; responseType: ResponseType; scaffoldLevel: ScaffoldLevel; misconceptionId?: string }>[];
    }>;

export type CandidateScene = Readonly<{
  id: string;
  type: SceneType;
  title: string;
  purpose: InstructionalPurpose;
  objectiveIds: readonly string[];
  learnerAction: string;
  content: Readonly<{ body: string; keyPoints?: readonly string[]; ageVariants?: Partial<Record<AgeBand, Readonly<{ body: string; keyPoints?: readonly string[] }>>> }>;
  interaction: CandidateInteraction;
  /** Required whenever the interaction or required media is not renderable everywhere (see deliverability). */
  fallback?: CandidateFallback;
  media?: readonly CandidateMedia[];
  tools: Readonly<{ requested: readonly string[]; prohibited: readonly string[] }>;
  /** Teacher/reviewer facing: what a successful learner response looks like. Never sent to learners. */
  expectedObservation?: string;
  hints: readonly string[];
  feedback?: Readonly<{ onSuccess: string; onStruggle: string }>;
  misconceptionIds: readonly string[];
  evidence: CandidateEvidence;
  accessibility: Readonly<{ textAlternative: string; keyboardPath: string; reducedMotion: "NOT_APPLICABLE" | "STATIC_EQUIVALENT"; nonPointerAlternative?: string }>;
  offline: Readonly<{ mode: OfflineMode; note: string }>;
  completion: "VIEWED" | "ALL_STEPS_REVEALED" | "ALL_ANSWERED" | "ALL_RESPONSES_WRITTEN" | "LAB_RETURNED_OR_FALLBACK";
  pedagogy?: Readonly<{ strategy: PedagogyStrategy; representation: Representation; scaffoldLevel: ScaffoldLevel }>;
  /** Earlier scenes this scene builds on (Phase C seam); must point backwards. */
  dependsOn?: readonly string[];
}>;

export type CandidateAssessmentRequest = Readonly<{
  id: string;
  objectiveIds: readonly string[];
  interaction: InteractionKind;
  evidenceType: "QUIZ" | "DIAGNOSTIC" | "PRACTICE";
  difficulty: "INTRO" | "CORE" | "STRETCH";
  misconceptionIds: readonly string[];
  tools: Readonly<{ requested: readonly string[]; prohibited: readonly string[] }>;
  offline: OfflineMode;
}>;

export type CandidateLabProposal = Readonly<{
  id: string;
  labId: string;
  objectiveId: string;
  placementSceneId: string;
  requirement: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
  checkIds: readonly string[];
  rationale: string;
}>;

export type CandidateMisconception = Readonly<{ id: string; objectiveId: string; description: string; response: string }>;

export type CandidateLessonV2 = Readonly<{
  contractVersion: typeof CANDIDATE_LESSON_V2_CONTRACT;
  title: string;
  estimatedMinutes: number;
  ageBand: AgeBand;
  pedagogy?: Readonly<{ primaryStrategy: PedagogyStrategy; rationale: string }>;
  prerequisiteAssumptions: readonly string[];
  misconceptions: readonly CandidateMisconception[];
  scenes: readonly CandidateScene[];
  assessmentRequests: readonly CandidateAssessmentRequest[];
  labProposals: readonly CandidateLabProposal[];
}>;

// ─── Server-assembled artifact ──────────────────────────────────────────────

export type ResolvedObjective = Readonly<{
  id: string;
  statement: string;
  grade: number;
  subject: string;
  topicKey: string;
  unitId: string;
  sourcePages: readonly number[];
  sourceConfidence: "HIGH" | "MEDIUM" | "LOW";
  conceptIds: readonly string[];
  standardCodes: readonly string[];
  skillIds: readonly string[];
}>;

export type ResolvedAssessmentHandoff = Readonly<{
  requestId: string;
  player: "ASSESSMENT_PLAYER_V2";
  scoring: "SERVER_AUTHORITY";
  objectiveIds: readonly string[];
  interaction: InteractionKind;
  evidenceType: "QUIZ" | "DIAGNOSTIC" | "PRACTICE";
  difficulty: "INTRO" | "CORE" | "STRETCH";
  misconceptionIds: readonly string[];
  tools: Readonly<{ allowed: readonly string[]; prohibited: readonly string[] }>;
  offline: OfflineMode;
  /** Governed release items for these objectives (learner-safe refs only; keys stay in the release). */
  governedItems: readonly Readonly<{ itemId: string; itemVersion: string; prompt: string; options: readonly string[] }>[];
}>;

export type LabEligibility = Readonly<{ studentEligible: boolean; reasons: readonly string[] }>;
export type ResolvedLabLink = Readonly<{ link: LearningExperienceLink; proposalId: string; rationale: string; eligibility: LabEligibility }>;

export type ReviewGap = Readonly<{
  code: string;
  severity: "BLOCKING" | "ADVISORY";
  sceneId?: string;
  detail: string;
}>;

export type CurriculumLessonV2 = Readonly<{
  contractVersion: typeof CURRICULUM_LESSON_V2_CONTRACT;
  identity: Readonly<{ lessonId: string; version: string; title: string; grade: number; subject: string; unitId: string }>;
  authoring: Readonly<{
    releaseId: string;
    releaseIdentity: string;
    cellId: string;
    cellVersion: string;
    contextHash: string;
    source: Readonly<{ archiveChecksum: string; sourceMember: string; memberChecksum: string | null; structuredReportVersion: string }>;
  }>;
  ageBand: AgeBand;
  estimatedMinutes: number;
  pedagogy: CandidateLessonV2["pedagogy"] | null;
  objectives: readonly ResolvedObjective[];
  prerequisites: Readonly<{ conceptIds: readonly string[]; assumptions: readonly string[] }>;
  misconceptions: readonly CandidateMisconception[];
  scenes: readonly CandidateScene[];
  assessmentHandoffs: readonly ResolvedAssessmentHandoff[];
  labLinks: readonly ResolvedLabLink[];
  provenance: Readonly<{
    generatorName: string;
    generatorVersion: string;
    candidateSha256: string;
    /** AUTHORED_FIXTURE: written offline in the generator format (no live model call), e.g. the G4 proof. */
    origin: "AI_GENERATED" | "AUTHORED_FIXTURE" | "MIGRATED_LEGACY";
    promptKey: string | null;
    promptVersion: string | null;
    promptHash: string | null;
    model: string | null;
    generatedAt: string;
    migration: Readonly<{ adapterVersion: string; sourceContentId: string; sourceVersion: string; sourceSha256: string; sectionMap: readonly Readonly<{ from: string; toSceneId: string | null }>[]; omissions: readonly string[] }> | null;
  }>;
  /** Generation can never set anything but this: approval comes only from governed human review. */
  governance: Readonly<{ state: "DRAFT"; humanReviewRequired: true; published: false; moeApprovalState: "NOT_CLAIMED"; requiredApprovalBasis: "HUMAN_REVIEW" }>;
  reviewGaps: readonly ReviewGap[];
}>;

/** Payload key that marks a CurriculumContent row as a native Curriculum V2 artifact. */
export const CURRICULUM_V2_PAYLOAD_KEY = "curriculumV2" as const;

/** Payload keys that carry native scene structure (V2 artifact, or a Phase A experience stored directly). */
export const NATIVE_SCENE_PAYLOAD_KEYS = Object.freeze([CURRICULUM_V2_PAYLOAD_KEY, "lessonExperience"] as const);

/**
 * Fails closed: any payload carrying a native-scene key counts as native Curriculum V2, whatever
 * contract version it claims, so a malformed or relabelled artifact cannot fall back to legacy
 * approval rules.
 */
export function isNativeCurriculumV2Payload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return NATIVE_SCENE_PAYLOAD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(payload, key));
}
