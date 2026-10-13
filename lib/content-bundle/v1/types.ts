/**
 * ContentBundle V1 — pure domain contract (PROVISIONAL).
 *
 * A ContentBundle defines WHAT CAN BE LEARNED: governed, exact-version references to lessons,
 * activities, assessments, labs and resources, bound to a curriculum release. It never records
 * what happened (attempts, submissions, scores), what a student knows (mastery) or what happens
 * next (orchestration). Those belong to operational systems, the Student Learning Model and the
 * Learning Orchestrator respectively.
 *
 * Names and structure are provisional until CONTENT_FACTORY_READINESS_V1 converges; see
 * docs/architecture/content-factory/CONTENT_BUNDLE_V1_FOUNDATION.md.
 */

export const CONTENT_BUNDLE_SCHEMA_VERSION = "content-bundle.v1" as const;
export const LEARNER_CONTENT_BUNDLE_SCHEMA_VERSION = "learner-content-bundle.v1" as const;

// ─── Governed identity ──────────────────────────────────────────────────────────────────────────

export const ACTIVITY_KINDS = ["CLASSWORK", "HOMEWORK", "PRACTICE", "PROJECT", "INVESTIGATION", "PRACTICAL", "GROUP_WORK"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ASSESSMENT_ITEM_KINDS = ["QUIZ", "ASSESSMENT"] as const;
export type AssessmentItemKind = (typeof ASSESSMENT_ITEM_KINDS)[number];

export const GOVERNED_ITEM_KINDS = ["LESSON", ...ACTIVITY_KINDS, ...ASSESSMENT_ITEM_KINDS, "LAB"] as const;
export type GovernedItemKind = (typeof GOVERNED_ITEM_KINDS)[number];

/** Exact-version identity of one item inside a bundle. */
export type BundleItemIdentity<K extends GovernedItemKind = GovernedItemKind> = Readonly<{
  itemId: string;
  itemVersion: string;
  itemKind: K;
}>;

/**
 * The common identity glue future consumers (ScheduledWork, attempts, submissions, evidence,
 * offline packages, teacher views, progress readers) will store to point at governed content.
 * It pins both the bundle version and the item version; nothing here is resolved by title or
 * "latest".
 */
export type GovernedContentRef = Readonly<{
  bundleId: string;
  bundleVersion: string;
  itemId: string;
  itemVersion: string;
  itemKind: GovernedItemKind;
}>;

// ─── Shared value shapes ────────────────────────────────────────────────────────────────────────

export type ConfigValue = string | number | boolean;
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type Audience = "LEARNER" | "TEACHER" | "SYSTEM";

export type AccessibilityMetadata = Readonly<{
  readingLevel: string | null;
  supportsScreenReader: boolean;
  supportsReadAloud: boolean;
  requiresColorVision: boolean;
  requiresFineMotor: boolean;
  alternativeFormatResourceIds: readonly string[];
}>;

// ─── Curriculum authority ───────────────────────────────────────────────────────────────────────

export type CurriculumAuthority = Readonly<{
  releaseId: string;
  releaseIdentity: string;
  objectiveIds: readonly string[];
  standardIds: readonly string[];
}>;

// ─── Sequence ───────────────────────────────────────────────────────────────────────────────────

/**
 * Structural ordering only. `prerequisiteItemIds` and `unlocksItemIds` describe the designed
 * dependency graph of content; they are not per-student decisions.
 */
export type SequenceEntry = Readonly<{
  itemId: string;
  order: number;
  prerequisiteItemIds: readonly string[];
  unlocksItemIds: readonly string[];
}>;

export type SequenceUnit = Readonly<{
  unitId: string;
  unitVersion: string;
  title: string;
  order: number;
  prerequisiteUnitIds: readonly string[];
  entries: readonly SequenceEntry[];
}>;

// ─── Lessons ────────────────────────────────────────────────────────────────────────────────────

export type LessonReference = Readonly<{
  identity: BundleItemIdentity<"LESSON">;
  title: string;
  objectiveIds: readonly string[];
  estimatedMinutes: number;
  resourceIds: readonly string[];
}>;

// ─── Activities ─────────────────────────────────────────────────────────────────────────────────

export type InstructionStep = Readonly<{ stepId: string; text: string; resourceIds: readonly string[] }>;

export type CollaborationMode = "INDIVIDUAL" | "PAIR" | "SMALL_GROUP" | "WHOLE_CLASS";
export type EvidenceIntentKind = "NONE" | "PRACTICE_ONLY" | "FORMATIVE" | "SUMMATIVE_CANDIDATE";
export type EvidenceForm = "WRITTEN" | "ORAL" | "PHOTO" | "ARTIFACT" | "OBSERVATION" | "DIGITAL_RESPONSE";

export type RubricReference = Readonly<{
  rubricId: string;
  rubricVersion: string;
  /** Criteria a learner may see before doing the work. */
  learnerVisibleCriteria: readonly string[];
  /** Teacher/system-only scoring guide; never projected to learners. */
  scoringGuideResourceId: string | null;
}>;

/**
 * Provisional content definition for non-lesson learning work. Content concerns only: no
 * submission, grade, teacher grading result, completion or attempt state.
 */
export type ActivityDefinition = Readonly<{
  identity: BundleItemIdentity<ActivityKind>;
  title: string;
  objectiveIds: readonly string[];
  /** Lessons this activity extends, by bundle item id. */
  lessonItemIds: readonly string[];
  scaffolding: "GUIDED" | "INDEPENDENT" | null;
  instructions: Readonly<{
    learner: readonly InstructionStep[];
    /** Teacher-facing facilitation notes; stripped from learner projection. */
    teacher: readonly InstructionStep[];
  }>;
  resourceIds: readonly string[];
  rubric: RubricReference | null;
  expectedDurationMinutes: number;
  collaborationMode: CollaborationMode;
  evidenceIntent: Readonly<{ kind: EvidenceIntentKind; forms: readonly EvidenceForm[] }>;
  accessibility: AccessibilityMetadata;
  extensions?: Readonly<Record<string, JsonValue>>;
}>;

// ─── Assessments ────────────────────────────────────────────────────────────────────────────────

export const ASSESSMENT_ROLES = ["FORMATIVE_CHECK", "QUIZ", "UNIT_ASSESSMENT", "EXAM", "WAEC_STYLE"] as const;
export type AssessmentRole = (typeof ASSESSMENT_ROLES)[number];

/** Pointer to a governed AssessmentDefinition (owned by a future assessment authority). */
export type AssessmentDefinitionRef = Readonly<{ definitionId: string; definitionVersion: string }>;
/** Pointer to a governed AssessmentItem. Carries no stem, options or keys. */
export type AssessmentItemRef = Readonly<{ assessmentItemId: string; assessmentItemVersion: string }>;

export type AssessmentReference = Readonly<{
  identity: BundleItemIdentity<AssessmentItemKind>;
  role: AssessmentRole;
  title: string;
  objectiveIds: readonly string[];
  definition: AssessmentDefinitionRef;
  items: readonly AssessmentItemRef[];
  learnerInstructions: readonly string[];
  /** Teacher/system-only material, referenced by resource id. Never projected to learners. */
  secured: Readonly<{ answerKeyResourceId: string | null; scoringGuideResourceId: string | null }>;
}>;

// ─── Labs ───────────────────────────────────────────────────────────────────────────────────────

export type LabRole = "CORE" | "OPTIONAL" | "ENRICHMENT" | "REMEDIATION";

/**
 * Reference to a governed lesson↔lab link. The bundle records which link it binds; it does not
 * certify the lab or the link. Showcase membership, standard-code matches and raw lab ids are not
 * authority, so the only accepted basis is GOVERNED_LINK.
 */
export type LabBinding = Readonly<{
  identity: BundleItemIdentity<"LAB">;
  linkId: string;
  labId: string;
  labVersion: string;
  objectiveIds: readonly string[];
  role: LabRole;
  placement: Readonly<{ lessonItemId: string; sceneId: string | null }>;
  authorityBasis: "GOVERNED_LINK";
}>;

// ─── Resources ──────────────────────────────────────────────────────────────────────────────────

export type ResourceKind =
  | "DOCUMENT"
  | "IMAGE"
  | "AUDIO"
  | "VIDEO"
  | "WORKSHEET"
  | "MANIPULATIVE"
  | "TEACHER_NOTE"
  | "ANSWER_KEY"
  | "SCORING_GUIDE";

export type ResourceReference = Readonly<{
  resourceId: string;
  resourceVersion: string;
  kind: ResourceKind;
  audience: Audience;
  title: string;
  locale: string;
  /** Offline asset carrying the bytes, if packaged. */
  assetId: string | null;
}>;

// ─── Toolkit ────────────────────────────────────────────────────────────────────────────────────

export type ToolkitBindingMode = "REQUIRED" | "OPTIONAL" | "PROHIBITED";
export type ToolkitScope = Readonly<{ kind: "BUNDLE" }> | Readonly<{ kind: "ITEM"; itemId: string }>;

export type ToolkitBinding = Readonly<{
  /** Canonical toolkit registry id (lib/toolkit/toolRegistry). */
  toolId: string;
  mode: ToolkitBindingMode;
  scope: ToolkitScope;
  /** Learner-visible configuration. */
  configuration: Readonly<Record<string, ConfigValue>>;
  /** Teacher/system configuration (e.g. proctoring parameters); stripped from learner projection. */
  internalConfiguration: Readonly<Record<string, ConfigValue>>;
  context: string | null;
}>;

// ─── Learner support ────────────────────────────────────────────────────────────────────────────

export type SupportLink = Readonly<{
  supportId: string;
  objectiveIds: readonly string[];
  itemIds: readonly string[];
  resourceIds: readonly string[];
}>;

export type AccommodationKind = "EXTENDED_TIME" | "READ_ALOUD" | "LARGE_PRINT" | "REDUCED_LOAD" | "ALTERNATE_FORMAT";

/** Accommodations the content supports. Assigning one to a student is not a bundle concern. */
export type AccommodationSupport = Readonly<{
  accommodationId: string;
  kind: AccommodationKind;
  presentation: Readonly<Record<string, ConfigValue>>;
}>;

export type LanguageVariant = Readonly<{ locale: string; itemId: string; resourceIds: readonly string[] }>;

export type LearnerSupport = Readonly<{
  remediation: readonly SupportLink[];
  enrichment: readonly SupportLink[];
  accommodations: readonly AccommodationSupport[];
  languageVariants: readonly LanguageVariant[];
}>;

// ─── Renderings (derived) ───────────────────────────────────────────────────────────────────────

export type RenderingKind = "TEXTBOOK" | "WORKBOOK" | "TEACHER_GUIDE" | "ASSESSMENT_BOOK";

/** A derived artifact compiled from the bundle. Never a source of curriculum authority. */
export type RenderingArtifactRef = Readonly<{
  renderingId: string;
  kind: RenderingKind;
  artifactVersion: string;
  artifactSha256: string;
  audience: Audience;
  derivation: "DERIVED";
  sourceAuthority: false;
}>;

// ─── Offline ────────────────────────────────────────────────────────────────────────────────────

export type OfflineAsset = Readonly<{
  assetId: string;
  assetVersion: string;
  sha256: string;
  byteSize: number;
  mediaType: string;
  audience: Audience;
}>;

export type OfflineCapabilityRestriction =
  | "NO_AI_TUTOR"
  | "NO_LIVE_ASSESSMENT"
  | "NO_SUMMATIVE_ASSESSMENT"
  | "NO_LAB_EVIDENCE_FINALIZATION"
  | "NO_SUBMISSION_FINALIZATION";

export type ReconnectRequirement = Readonly<{
  requiredFor: readonly ("SUBMISSION_SYNC" | "SUMMATIVE_ASSESSMENT" | "EVIDENCE_RECONCILIATION")[];
  maxOfflineDays: number | null;
}>;

/**
 * Offline packaging declaration. The exact bundle version/hash is bound when the package is
 * sealed (see projection.ts); a bundle cannot contain its own hash.
 */
export type OfflineManifest = Readonly<{
  packageable: boolean;
  assets: readonly OfflineAsset[];
  capabilityRestrictions: readonly OfflineCapabilityRestriction[];
  reconnectRequirement: ReconnectRequirement;
}>;

// ─── Governance ─────────────────────────────────────────────────────────────────────────────────

/** References only. Review decisions and approvals live in their own governed records. */
export type GovernanceReferences = Readonly<{
  provenance: Readonly<{ sourceIds: readonly string[]; generatorRunId: string | null }>;
  reviewIds: readonly string[];
  releaseRecordId: string | null;
  /** Internal reviewer notes; never projected to learners and excluded from the content hash. */
  reviewerNotes: readonly string[];
}>;

// ─── Bundle ─────────────────────────────────────────────────────────────────────────────────────

export type ContentBundleIdentity = Readonly<{
  bundleId: string;
  version: string;
  title: string;
  /** Grade level of the content (not a student grade/score). */
  gradeLevel: number;
  subject: string;
  locale: string;
}>;

export type ContentBundleV1 = Readonly<{
  schemaVersion: typeof CONTENT_BUNDLE_SCHEMA_VERSION;
  identity: ContentBundleIdentity;
  curriculumAuthority: CurriculumAuthority;
  sequence: Readonly<{ units: readonly SequenceUnit[] }>;
  lessons: readonly LessonReference[];
  activities: readonly ActivityDefinition[];
  assessments: readonly AssessmentReference[];
  labs: readonly LabBinding[];
  resources: readonly ResourceReference[];
  toolkitBindings: readonly ToolkitBinding[];
  learnerSupport: LearnerSupport;
  renderings: readonly RenderingArtifactRef[];
  offline: OfflineManifest;
  governance: GovernanceReferences;
  extensions?: Readonly<Record<string, JsonValue>>;
}>;

// ─── Validation results ─────────────────────────────────────────────────────────────────────────

export type ContentBundleValidationCode =
  | "malformed"
  | "unknown_field"
  | "schema_version_unsupported"
  | "identity_missing"
  | "version_missing"
  | "duplicate_id"
  | "unknown_item_kind"
  | "item_kind_section_mismatch"
  | "authority_malformed"
  | "objectives_empty"
  | "objective_not_in_authority"
  | "sequence_order_duplicate"
  | "sequence_order_invalid"
  | "sequence_reference_unknown"
  | "sequence_cycle"
  | "reference_unknown"
  | "assessment_identity_missing"
  | "assessment_role_invalid"
  | "assessment_secret_exposed"
  | "lab_binding_identity_missing"
  | "lab_binding_authority_insufficient"
  | "toolkit_collision"
  | "toolkit_binding_duplicate"
  | "offline_asset_malformed"
  | "resource_audience_conflict"
  | "rendering_claims_authority"
  | "student_state_forbidden"
  | "runtime_field_forbidden"
  | "answer_key_inline";

export type ContentBundleValidationError = Readonly<{
  code: ContentBundleValidationCode;
  /** JSON-path-like location, e.g. `activities[2].identity.itemVersion`. */
  path: string;
  message: string;
}>;

export type ContentBundleValidationResult =
  | Readonly<{ ok: true; bundle: ContentBundleV1; errors: readonly ContentBundleValidationError[] }>
  | Readonly<{ ok: false; bundle: null; errors: readonly ContentBundleValidationError[] }>;
