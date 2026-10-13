/**
 * ContentBundle V1 — pure domain contract (PROVISIONAL).
 *
 * A ContentBundle defines WHAT CAN BE LEARNED: governed, exact-version references to lessons,
 * activities, assessments, labs and resources, bound to a curriculum release. It never records
 * what happened (attempts, submissions, scores), what a student knows (mastery) or what happens
 * next (orchestration). Those belong to operational systems, the Student Learning Model and the
 * Learning Orchestrator respectively.
 *
 * Reconciled with CONTENT_FACTORY_READINESS_V1: an immutable composition manifest over existing
 * authority, with no second approval engine. Remaining open items are listed in
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
  /** Verified source/version pins the objectives derive from. */
  sourceVersionRefs: readonly string[];
  /** Ontology concept revisions the bundle teaches. */
  conceptRefs: readonly string[];
  /** Release construct bindings (objective to assessable construct). */
  constructBindingRefs: readonly string[];
}>;

// ─── Sequence ───────────────────────────────────────────────────────────────────────────────────

/**
 * Structural ordering only. `prerequisiteItemIds` and `unlocksItemIds` describe the designed
 * dependency graph of content; they are not per-student decisions.
 */
export type SequenceEntry = Readonly<{
  itemId: string;
  order: number;
  requirement: "REQUIRED" | "OPTIONAL";
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
 * Bundle display shape for non-lesson learning work and legacy contract fixtures.
 * Canonical governed identity and authority live in activity-definition/v1/ActivityDefinitionV1;
 * governed manifests store activityReferences and restore this shape through that resolver.
 * No submission, grade, teacher grading result, completion or attempt state.
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
  /**
   * Governed learner-facing body (activity-experience.v1, activityExperience.ts). First-class
   * activity content: hashed with the activity, strictly validated, projected by allow-list.
   * `extensions.experience` is rejected so there is exactly one experience surface.
   */
  experience?: import("./activityExperience").ActivityExperienceV1;
  extensions?: Readonly<Record<string, JsonValue>>;
}>;

// ─── Assessments ────────────────────────────────────────────────────────────────────────────────

export const ASSESSMENT_ROLES = ["FORMATIVE_CHECK", "QUIZ", "UNIT_ASSESSMENT", "EXAM", "WAEC_STYLE"] as const;
export type AssessmentRole = (typeof ASSESSMENT_ROLES)[number];

/** Pointer to a governed AssessmentDefinition (owned by a future assessment authority). */
export type AssessmentDefinitionRef = Readonly<{ definitionId: string; definitionVersion: string }>;
/** Pointer to a governed AssessmentItem. Carries no stem, options or keys. */
export type AssessmentItemRef = Readonly<{ assessmentItemId: string; assessmentItemVersion: string }>;

/**
 * How item order is authored. FIXED: `items` order is semantic and hashed. RANDOMIZED_BY_POLICY:
 * the reviewed randomization policy is hashed and `items` is treated as a set; the presentation
 * order belongs to the delivery/attempt, never to the bundle. Runtime randomization is not
 * implemented here.
 */
export type AssessmentItemOrder =
  | Readonly<{ kind: "FIXED" }>
  | Readonly<{ kind: "RANDOMIZED_BY_POLICY"; policyId: string; policyVersion: string }>;

/**
 * Bundle-side pointer to a governed AssessmentDefinition and its AssessmentItems. Delivery,
 * attempts, scores and evidence are separate concepts owned elsewhere and never appear here.
 */
export type AssessmentReference = Readonly<{
  identity: BundleItemIdentity<AssessmentItemKind>;
  role: AssessmentRole;
  title: string;
  objectiveIds: readonly string[];
  definition: AssessmentDefinitionRef;
  items: readonly AssessmentItemRef[];
  itemOrder: AssessmentItemOrder;
  learnerInstructions: readonly string[];
  /** Teacher/system-only material, referenced by resource id. Never projected to learners. */
  secured: Readonly<{ answerKeyResourceId: string | null; scoringGuideResourceId: string | null }>;
}>;

// ─── Labs ───────────────────────────────────────────────────────────────────────────────────────

export type LabRole = "CORE" | "OPTIONAL" | "ENRICHMENT" | "REMEDIATION";

/**
 * Three separate identities:
 *   - `identity`: the bundle member (composition identity);
 *   - `link`: the governed LearningExperienceLink relationship, pinned to an exact revision;
 *   - `lab`: the lab experience and its exact version.
 * The member id is NOT required to equal the link id. The bundle records which governed link it
 * binds; certification, eligibility and access stay with the lab registry and link governance.
 * Showcase membership, standard-code matches and raw lab ids are not authority, so the only
 * accepted basis is GOVERNED_LINK.
 */
export type LabBinding = Readonly<{
  identity: BundleItemIdentity<"LAB">;
  link: Readonly<{ linkId: string; linkRevision: string }>;
  lab: Readonly<{ labId: string; labVersion: string }>;
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

/**
 * `toolId` is a canonical governed tool identifier, in the namespace tool policies use (for
 * example `fraction_strips`), NOT the runtime toolkit registry namespace (`fraction-visualizer`).
 * Translation to runtime implementations goes through a reviewed, versioned mapping pinned by
 * `ContentBundleV1.toolkitMapping` (see toolkitMapping.ts). There is no spelling normalization
 * or implied equivalence.
 */
export type ToolkitBinding = Readonly<{
  toolId: string;
  mode: ToolkitBindingMode;
  scope: ToolkitScope;
  /** Learner-visible configuration. */
  configuration: Readonly<Record<string, ConfigValue>>;
  /** Teacher/system configuration (e.g. proctoring parameters); stripped from learner projection. */
  internalConfiguration: Readonly<Record<string, ConfigValue>>;
  context: string | null;
}>;

/** Pin of the reviewed canonical-to-runtime tool mapping this bundle was composed against. */
export type ToolkitMappingRef = Readonly<{ mappingId: string; mappingVersion: string }>;

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

/** Allow-list: any capability not listed is unavailable offline. */
export type OfflineCapability = "LESSON_PLAYBACK" | "FORMATIVE_PRACTICE" | "RESPONSE_QUEUE" | "LOCAL_TOOLS" | "PRINTABLE_WORKSHEETS";

export type ReconnectSemantics = Readonly<{
  requiredFor: readonly ("SUBMISSION_SYNC" | "SUMMATIVE_ASSESSMENT" | "EVIDENCE_RECONCILIATION")[];
  maxOfflineDays: number | null;
}>;

/**
 * Offline packaging plan. A package built from it pins exactly one bundleId, version and
 * contentHash, the release identity, exact member versions and exact asset hashes (see
 * projection.ts). Learner and staff packages are separate projections.
 */
export type OfflineManifest = Readonly<{
  packageable: boolean;
  assets: readonly OfflineAsset[];
  allowedCapabilities: readonly OfflineCapability[];
  reconnectSemantics: ReconnectSemantics;
}>;

// ─── Governance ─────────────────────────────────────────────────────────────────────────────────

/**
 * References to existing governance records only. The bundle has no approval flag and no notes.
 *   - provenanceRefs: immutable lineage of this composition revision; part of the content hash.
 *   - reviewRefs, lifecycleRefs, releaseRefs: attestations and events ABOUT a sealed
 *     (bundleId, version, contentHash). They are excluded from the content hash; otherwise
 *     recording an approval would change what was approved.
 */
export type GovernanceReferences = Readonly<{
  provenanceRefs: readonly string[];
  reviewRefs: readonly string[];
  lifecycleRefs: readonly string[];
  releaseRefs: readonly string[];
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
  /**
   * SHA-256 of the canonical composition, excluding this field. null for an unsealed draft. When
   * set, validation rejects it unless it matches the recomputed hash.
   */
  contentHash: string | null;
}>;

export type ContentBundleV1 = Readonly<{
  schemaVersion: typeof CONTENT_BUNDLE_SCHEMA_VERSION;
  identity: ContentBundleIdentity;
  curriculumAuthority: CurriculumAuthority;
  sequence: Readonly<{ units: readonly SequenceUnit[] }>;
  lessons: readonly LessonReference[];
  activities: readonly ActivityDefinition[];
  /** Immutable authority pointers. Payloads are restored only during server resolution. */
  activityReferences?: readonly import("@/lib/activity-definition/v1/types").ActivityReference[];
  assessments: readonly AssessmentReference[];
  labs: readonly LabBinding[];
  resources: readonly ResourceReference[];
  toolkitBindings: readonly ToolkitBinding[];
  toolkitMapping: ToolkitMappingRef | null;
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
  | "content_hash_stale"
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
  | "answer_key_inline"
  | "activity_experience_invalid";

export type ContentBundleValidationError = Readonly<{
  code: ContentBundleValidationCode;
  /** JSON-path-like location, e.g. `activities[2].identity.itemVersion`. */
  path: string;
  message: string;
}>;

export type ContentBundleValidationResult =
  | Readonly<{ ok: true; bundle: ContentBundleV1; errors: readonly ContentBundleValidationError[] }>
  | Readonly<{ ok: false; bundle: null; errors: readonly ContentBundleValidationError[] }>;
