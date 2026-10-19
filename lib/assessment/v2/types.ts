/**
 * Assessment Architecture V2 — governed, versioned assessment contracts (pure domain).
 *
 * This module is the "future assessment authority" that ContentBundle V1 points at through
 * `AssessmentDefinitionRef` / `AssessmentItemRef` (lib/content-bundle/v1/types.ts). It defines
 * WHAT is assessed and under which authority. It never records a student's knowledge (that is the
 * Student Learning Model) and it never writes grades or mastery. Downstream consumers read
 * assessment evidence only through lib/assessment/v2/consumers.ts.
 *
 * Separation that every type below preserves:
 *   - learner-visible content (stimulus, options, response contract) lives on the item;
 *   - protected scoring material (keys, tolerances, rubrics, hidden explanations) lives in a
 *     separate `ProtectedScoringSpec` that only the server scorer and authorized reviewers read;
 *   - lifecycle attestations (reviews, releases) point at exact (id, version, hash) and are never
 *     hashed into the content they attest to.
 *
 * See docs/architecture/assessment/ASSESSMENT_ARCHITECTURE_V2.md.
 */

export const ASSESSMENT_V2_SCHEMA_VERSION = "assessment.v2" as const;

// ─── Shared vocabulary ──────────────────────────────────────────────────────────────────────────

export const ASSESSMENT_PURPOSES = [
  "DIAGNOSTIC",
  "FORMATIVE",
  "SUMMATIVE",
  "RETENTION",
  "TRANSFER",
  "EXAMINATION",
  "PERFORMANCE",
] as const;
export type AssessmentPurpose = (typeof ASSESSMENT_PURPOSES)[number];

export const ITEM_TYPES = [
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "NUMERIC",
  "ORDERING",
  "MATCHING",
  "SHORT_CONSTRUCTED",
  "EXTENDED_WRITING",
  "WORKED_SOLUTION",
  "PERFORMANCE_TASK",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const COGNITIVE_DEMANDS = ["RECALL", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;
export type CognitiveDemand = (typeof COGNITIVE_DEMANDS)[number];

/** Relationship of the item context to how the lesson taught it. NEW = transfer context. */
export type ItemContext = "REHEARSED" | "NEAR" | "NEW";

/**
 * Lifecycle of a definition, item or form. Content status is derived from attestations replayed
 * by lifecycle.ts; a stored status string is never trusted on its own.
 */
export const CONTENT_STATUSES = ["CANDIDATE", "VALIDATED", "IN_REVIEW", "APPROVED", "REJECTED", "RETIRED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type AuthorKind = "HUMAN" | "AI" | "IMPORTED_LEGACY";

export type Provenance = Readonly<{
  authors: readonly Readonly<{ kind: AuthorKind; id: string }>[];
  /** Where the content came from (repo path, legacy table, authoring session). */
  sourceRef: string;
  /** National curriculum source pins (MOE syllabus refs) the content claims alignment with. */
  curriculumSourceRefs: readonly string[];
}>;

export type CurriculumAlignment = Readonly<{
  /** Curriculum/ontology release the assessment is composed against. */
  releaseId: string;
  releaseIdentity: string;
  /** Objectives that come from the national curriculum (MOE). */
  nationalObjectiveIds: readonly string[];
  /** LiberiaLearn-owned extensions, kept separate so they are never reported as MOE-required. */
  extensionObjectiveIds: readonly string[];
}>;

// ─── AssessmentDefinition ───────────────────────────────────────────────────────────────────────

export type AttemptPolicy = Readonly<{
  maxAttempts: number;
  /** Minimum minutes between attempts; 0 = immediate retry allowed. */
  cooldownMinutes: number;
  /** Which attempt is reported when several exist. Never "average": attempts are not combinable by default. */
  reportedAttempt: "FIRST" | "LATEST" | "HIGHEST";
}>;

export type PermittedTool = Readonly<{ toolId: string; mode: "ALLOWED" | "PROHIBITED" }>;

export type Accommodation =
  | "EXTENDED_TIME"
  | "READ_ALOUD"
  | "LARGE_PRINT"
  | "SCRIBE"
  | "SEPARATE_SETTING"
  | "ALTERNATE_LANGUAGE_SUPPORT";

export type AssessmentDefinitionV2 = Readonly<{
  schemaVersion: typeof ASSESSMENT_V2_SCHEMA_VERSION;
  definitionId: string;
  version: string;
  /** Computed by hash.ts; excluded from its own payload. */
  contentHash: string;
  title: string;
  purpose: AssessmentPurpose;
  grade: number;
  subject: string;
  objectiveIds: readonly string[];
  /** Objectives whose mastery must be checked before this assessment is meaningful. */
  prerequisiteObjectiveIds: readonly string[];
  alignment: CurriculumAlignment;
  timeLimitMinutes: number | null;
  permittedTools: readonly PermittedTool[];
  permittedAccommodations: readonly Accommodation[];
  attemptPolicy: AttemptPolicy;
  provenance: Provenance;
}>;

// ─── AssessmentItem ─────────────────────────────────────────────────────────────────────────────

export type ChoiceOption = Readonly<{ optionId: string; text: string }>;

/** Learner-visible stimulus. No field here may carry a key, rubric or hidden explanation. */
export type ItemStimulus = Readonly<{
  prompt: string;
  /** Optional passage, table or figure description shown with the prompt. */
  context: string | null;
  resourceIds: readonly string[];
  options: readonly ChoiceOption[];
  /** ORDERING: the elements to arrange. MATCHING: left and right columns. */
  orderingElements: readonly ChoiceOption[];
  matchingLeft: readonly ChoiceOption[];
  matchingRight: readonly ChoiceOption[];
  /** NUMERIC: the unit the learner must answer in, when it is part of the question. */
  expectedUnit: string | null;
  /** Rubric criteria a learner may see before answering (writing, performance). */
  learnerVisibleCriteria: readonly string[];
}>;

export type Hint = Readonly<{ hintId: string; text: string }>;

/**
 * When feedback material may be shown to a learner. Hints are learner-requestable support and are
 * recorded as assistance; explanations are post-response disclosure.
 */
export type FeedbackReleasePolicy = Readonly<{
  hints: "NONE" | "ON_REQUEST";
  explanation: "NEVER" | "AFTER_RESPONSE" | "AFTER_ATTEMPT_CLOSED" | "AFTER_RELEASE_WINDOW";
  correctAnswer: "NEVER" | "AFTER_RESPONSE" | "AFTER_ATTEMPT_CLOSED" | "AFTER_RELEASE_WINDOW";
}>;

export type MisconceptionMapping = Readonly<{
  misconceptionId: string;
  /** Choice option or response pattern that signals the misconception. Protected: lives in the spec. */
  remediationRef: string | null;
}>;

export type AssessmentItemV2 = Readonly<{
  schemaVersion: typeof ASSESSMENT_V2_SCHEMA_VERSION;
  itemId: string;
  /** Immutable: any content change requires a new version, and a new hash. */
  version: string;
  /** Hash of the item content AND its protected scoring spec (hash.ts). */
  itemHash: string;
  itemType: ItemType;
  stimulus: ItemStimulus;
  objectiveIds: readonly string[];
  misconceptionIds: readonly string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  cognitiveDemand: CognitiveDemand;
  context: ItemContext;
  hints: readonly Hint[];
  feedbackPolicy: FeedbackReleasePolicy;
  /** Hash of the protected scoring spec this item version was authored with. */
  scoringSpecHash: string;
  provenance: Provenance;
}>;

// ─── Protected scoring specification (server-only) ──────────────────────────────────────────────

export type NumericKey = Readonly<{
  value: number;
  /** Absolute tolerance; 0 = exact. */
  absoluteTolerance: number;
  /** Accepted unit spellings (normalized lowercase); empty = unit not assessed. */
  acceptedUnits: readonly string[];
  /** Credit fraction awarded when the value is right but the unit is missing or wrong. */
  wrongUnitCredit: number;
}>;

export type RubricLevel = Readonly<{ points: number; descriptor: string }>;
export type RubricCriterion = Readonly<{
  criterionId: string;
  title: string;
  levels: readonly RubricLevel[];
  /** LL-AEP-001 authentic-work dimension this criterion assesses (REASONING, EVIDENCE, …). */
  dimension?: string;
}>;
export type Rubric = Readonly<{ rubricId: string; rubricVersion: string; criteria: readonly RubricCriterion[] }>;

export type ScoringKey =
  | Readonly<{ kind: "SINGLE_SELECT"; correctOptionId: string }>
  | Readonly<{ kind: "MULTI_SELECT"; correctOptionIds: readonly string[]; partialCredit: "NONE" | "PER_OPTION_NET" }>
  | Readonly<{ kind: "NUMERIC"; key: NumericKey }>
  | Readonly<{ kind: "ORDERING"; correctOrder: readonly string[]; partialCredit: "NONE" | "ADJACENT_PAIRS" }>
  | Readonly<{ kind: "MATCHING"; pairs: readonly Readonly<{ leftId: string; rightId: string }>[]; partialCredit: "NONE" | "PER_PAIR" }>
  /** Exact-match short answers may be auto-scored; anything else needs a human. */
  | Readonly<{ kind: "SHORT_CONSTRUCTED"; acceptedAnswers: readonly string[]; autoScore: "EXACT_NORMALIZED" | "HUMAN_ONLY" }>
  | Readonly<{ kind: "RUBRIC"; rubric: Rubric }>;

export type ProtectedScoringSpec = Readonly<{
  schemaVersion: typeof ASSESSMENT_V2_SCHEMA_VERSION;
  itemId: string;
  itemVersion: string;
  scoringVersion: string;
  maxPoints: number;
  key: ScoringKey;
  /** Hidden worked explanation; released only by the item's feedback policy. */
  explanation: string | null;
  /** optionId (or response pattern id) → misconception id. */
  misconceptionSignals: readonly Readonly<{ responsePattern: string; misconceptionId: string }>[];
  /** Exemplars and moderation notes for human scorers. Never projected. */
  moderationNotes: readonly string[];
}>;

// ─── AssessmentForm ─────────────────────────────────────────────────────────────────────────────

export type FormItemRef = Readonly<{ itemId: string; itemVersion: string; itemHash: string; points: number }>;

export type DeliveryRules = Readonly<{
  itemOrder: "FIXED" | "RANDOMIZED_BY_POLICY";
  randomizationPolicyId: string | null;
  allowBacktracking: boolean;
  /** Whether an offline package of this form may be built. Constructed-response items can still be captured offline. */
  offlineDelivery: "PROHIBITED" | "CAPTURE_ONLY";
}>;

export type ScoringBlueprint = Readonly<{
  blueprintVersion: string;
  /** Total points must equal the sum of item points. */
  totalPoints: number;
  /** Objective coverage: every objective must be measured by at least `minItems` items. */
  objectiveCoverage: readonly Readonly<{ objectiveId: string; minItems: number }>[];
}>;

export type AssessmentFormV2 = Readonly<{
  schemaVersion: typeof ASSESSMENT_V2_SCHEMA_VERSION;
  formId: string;
  version: string;
  formHash: string;
  definition: Readonly<{ definitionId: string; version: string; contentHash: string }>;
  /** Ordered: order is semantic for FIXED forms and hashed. */
  items: readonly FormItemRef[];
  delivery: DeliveryRules;
  blueprint: ScoringBlueprint;
}>;

// ─── AssessmentReview ───────────────────────────────────────────────────────────────────────────

export const REVIEW_CHECKS = ["ACCURACY", "ITEM_VALIDITY", "ANSWER_VERIFICATION", "FAIRNESS", "ACCESSIBILITY"] as const;
export type ReviewCheck = (typeof REVIEW_CHECKS)[number];

export type ReviewSubject =
  | Readonly<{ kind: "ITEM"; itemId: string; version: string; hash: string }>
  | Readonly<{ kind: "FORM"; formId: string; version: string; hash: string }>
  | Readonly<{ kind: "DEFINITION"; definitionId: string; version: string; hash: string }>;

export type ReviewerRole = "ASSESSMENT_REVIEWER" | "CURRICULUM_LEAD" | "PLATFORM_ADMIN";

export type ReviewActor =
  | Readonly<{ kind: "HUMAN"; userId: string; role: ReviewerRole | "TEACHER" | "STUDENT" | "SCHOOL_ADMIN" }>
  /** AI reviewers produce recommendations only. lifecycle.ts never counts them toward approval. */
  | Readonly<{ kind: "AI"; agentId: string }>;

export type AssessmentReviewV2 = Readonly<{
  reviewId: string;
  subject: ReviewSubject;
  actor: ReviewActor;
  checks: readonly Readonly<{ check: ReviewCheck; outcome: "PASS" | "FAIL"; note: string }>[];
  decision: "APPROVE" | "REJECT" | "RECOMMEND_APPROVE" | "RECOMMEND_REJECT";
  occurredAt: string;
}>;

// ─── AssessmentRelease ──────────────────────────────────────────────────────────────────────────

export const DELIVERY_MODES = ["REVIEWER_PREVIEW", "PRACTICE_UNOFFICIAL", "OFFICIAL"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export type AssessmentReleaseV2 = Readonly<{
  schemaVersion: typeof ASSESSMENT_V2_SCHEMA_VERSION;
  releaseId: string;
  releaseHash: string;
  definition: Readonly<{ definitionId: string; version: string; contentHash: string }>;
  form: Readonly<{ formId: string; version: string; formHash: string }>;
  items: readonly Readonly<{ itemId: string; itemVersion: string; itemHash: string; scoringSpecHash: string }>[];
  objectiveIds: readonly string[];
  curriculum: Readonly<{ releaseId: string; releaseIdentity: string }>;
  permittedModes: readonly DeliveryMode[];
  effectiveFrom: string;
  effectiveUntil: string | null;
  /** School scope; null = national release (requires PLATFORM_ADMIN authority). */
  schoolId: string | null;
  authorizedBy: Readonly<{ userId: string; role: ReviewerRole }>;
  authorizedAt: string;
}>;

export type ReleaseRevocation = Readonly<{
  releaseId: string;
  releaseHash: string;
  revokedBy: Readonly<{ userId: string; role: ReviewerRole }>;
  reason: string;
  revokedAt: string;
  /** Evidence collected under the revoked release is re-labelled, never deleted. */
  evidenceDisposition: "INVALIDATE" | "RETAIN_AS_UNOFFICIAL";
}>;
