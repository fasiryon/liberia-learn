/**
 * Learner-safe projection: ContentBundle → LearnerContentBundle.
 *
 * Pure data shaping. It decides what a learner-facing surface may carry, not whether a given
 * learner may open it: admission, enrollment and RBAC stay with the server routes that will
 * eventually call this. Teacher/system material is removed by allow-listing learner fields
 * rather than deleting known secret fields, so new internal fields stay out by default.
 */
import { sealContentBundle } from "./seal";
import type { ContentBundleValidationOptions } from "./validator";
import {
  LEARNER_CONTENT_BUNDLE_SCHEMA_VERSION,
  type AccessibilityMetadata,
  type AccommodationSupport,
  type ActivityKind,
  type AssessmentDefinitionRef,
  type AssessmentItemKind,
  type AssessmentRole,
  type BundleItemIdentity,
  type CollaborationMode,
  type ConfigValue,
  type ContentBundleV1,
  type ContentBundleValidationError,
  type EvidenceForm,
  type EvidenceIntentKind,
  type GovernedContentRef,
  type GovernedItemKind,
  type LabBinding,
  type LessonReference,
  type OfflineCapability,
  type ReconnectSemantics,
  type RenderingKind,
  type ResourceKind,
  type SequenceUnit,
  type SupportLink,
  type ToolkitMappingRef,
  type ToolkitScope,
} from "./types";

export const LEARNER_PROJECTION_VERSION = "learner-projection.v1" as const;

export type LearnerInstructionStep = Readonly<{ stepId: string; text: string; resourceIds: readonly string[] }>;

export type LearnerActivity = Readonly<{
  identity: BundleItemIdentity<ActivityKind>;
  title: string;
  objectiveIds: readonly string[];
  lessonItemIds: readonly string[];
  scaffolding: "GUIDED" | "INDEPENDENT" | null;
  instructions: readonly LearnerInstructionStep[];
  resourceIds: readonly string[];
  rubric: Readonly<{ rubricId: string; rubricVersion: string; criteria: readonly string[] }> | null;
  expectedDurationMinutes: number;
  collaborationMode: CollaborationMode;
  evidenceIntent: Readonly<{ kind: EvidenceIntentKind; forms: readonly EvidenceForm[] }>;
  accessibility: AccessibilityMetadata;
}>;

/** Safe assessment pointer: identity, role and instructions. No item list, keys or scoring guides. */
export type LearnerAssessmentReference = Readonly<{
  identity: BundleItemIdentity<AssessmentItemKind>;
  role: AssessmentRole;
  title: string;
  objectiveIds: readonly string[];
  definition: AssessmentDefinitionRef;
  /** Whether the authored order is fixed. The actual order comes from the delivery session. */
  itemOrder: "FIXED" | "RANDOMIZED";
  learnerInstructions: readonly string[];
}>;

export type LearnerResource = Readonly<{
  resourceId: string;
  resourceVersion: string;
  kind: ResourceKind;
  title: string;
  locale: string;
  assetId: string | null;
}>;

export type LearnerToolBinding = Readonly<{
  toolId: string;
  mode: "REQUIRED" | "OPTIONAL";
  scope: ToolkitScope;
  configuration: Readonly<Record<string, ConfigValue>>;
  context: string | null;
}>;

export type LearnerContentBundle = Readonly<{
  schemaVersion: typeof LEARNER_CONTENT_BUNDLE_SCHEMA_VERSION;
  source: Readonly<{ bundleId: string; bundleVersion: string; contentHash: string }>;
  identity: Readonly<{ title: string; gradeLevel: number; subject: string; locale: string }>;
  objectives: Readonly<{ releaseId: string; releaseIdentity: string; objectiveIds: readonly string[]; standardIds: readonly string[] }>;
  sequence: Readonly<{ units: readonly SequenceUnit[] }>;
  lessons: readonly LessonReference[];
  activities: readonly LearnerActivity[];
  assessments: readonly LearnerAssessmentReference[];
  labs: readonly LabBinding[];
  resources: readonly LearnerResource[];
  /**
   * REQUIRED/OPTIONAL canonical tool ids only. Prohibitions are enforced server-side, not
   * advertised. Runtime ids come from the pinned mapping, never from spelling.
   */
  tools: readonly LearnerToolBinding[];
  toolkitMapping: ToolkitMappingRef | null;
  learnerSupport: Readonly<{
    remediation: readonly SupportLink[];
    enrichment: readonly SupportLink[];
    accommodations: readonly AccommodationSupport[];
    languageVariants: readonly Readonly<{ locale: string; itemId: string; resourceIds: readonly string[] }>[];
  }>;
  renderings: readonly Readonly<{ renderingId: string; kind: RenderingKind; artifactVersion: string; artifactSha256: string }>[];
  /**
   * Learner offline package identity: exactly one bundle version and hash, its release identity,
   * exact member versions and exact learner asset hashes. Staff packages are a separate
   * projection and are not produced here.
   */
  offline: Readonly<{
    audience: "LEARNER";
    projectionVersion: typeof LEARNER_PROJECTION_VERSION;
    bundleId: string;
    bundleVersion: string;
    contentHash: string;
    releaseIdentity: string;
    packageable: boolean;
    members: readonly BundleItemIdentity<GovernedItemKind>[];
    assets: readonly Readonly<{ assetId: string; assetVersion: string; sha256: string; byteSize: number; mediaType: string }>[];
    allowedCapabilities: readonly OfflineCapability[];
    reconnectSemantics: ReconnectSemantics;
  }>;
}>;

const LEARNER_RENDERING_KINDS: ReadonlySet<RenderingKind> = new Set(["TEXTBOOK", "WORKBOOK"]);

/** Pure projection of an already-validated bundle and its content hash. */
export function projectLearnerBundle(bundle: ContentBundleV1, contentHash: string): LearnerContentBundle {
  const learnerResources = new Set(bundle.resources.filter((r) => r.audience === "LEARNER").map((r) => r.resourceId));
  const learnerAssets = new Set(bundle.offline.assets.filter((a) => a.audience === "LEARNER").map((a) => a.assetId));
  const onlyLearner = (ids: readonly string[]) => ids.filter((id) => learnerResources.has(id));
  const supportLink = (link: SupportLink): SupportLink => ({ supportId: link.supportId, objectiveIds: [...link.objectiveIds], itemIds: [...link.itemIds], resourceIds: onlyLearner(link.resourceIds) });

  return {
    schemaVersion: LEARNER_CONTENT_BUNDLE_SCHEMA_VERSION,
    source: { bundleId: bundle.identity.bundleId, bundleVersion: bundle.identity.version, contentHash },
    identity: { title: bundle.identity.title, gradeLevel: bundle.identity.gradeLevel, subject: bundle.identity.subject, locale: bundle.identity.locale },
    objectives: {
      releaseId: bundle.curriculumAuthority.releaseId,
      releaseIdentity: bundle.curriculumAuthority.releaseIdentity,
      objectiveIds: [...bundle.curriculumAuthority.objectiveIds],
      standardIds: [...bundle.curriculumAuthority.standardIds],
    },
    sequence: {
      units: bundle.sequence.units.map((unit) => ({
        unitId: unit.unitId,
        unitVersion: unit.unitVersion,
        title: unit.title,
        order: unit.order,
        prerequisiteUnitIds: [...unit.prerequisiteUnitIds],
        entries: unit.entries.map((entry) => ({ itemId: entry.itemId, order: entry.order, requirement: entry.requirement, prerequisiteItemIds: [...entry.prerequisiteItemIds], unlocksItemIds: [...entry.unlocksItemIds] })),
      })),
    },
    lessons: bundle.lessons.map((lesson) => ({
      identity: { ...lesson.identity },
      title: lesson.title,
      objectiveIds: [...lesson.objectiveIds],
      estimatedMinutes: lesson.estimatedMinutes,
      resourceIds: onlyLearner(lesson.resourceIds),
    })),
    activities: bundle.activities.map((activity) => ({
      identity: { ...activity.identity },
      title: activity.title,
      objectiveIds: [...activity.objectiveIds],
      lessonItemIds: [...activity.lessonItemIds],
      scaffolding: activity.scaffolding,
      instructions: activity.instructions.learner.map((step) => ({ stepId: step.stepId, text: step.text, resourceIds: onlyLearner(step.resourceIds) })),
      resourceIds: onlyLearner(activity.resourceIds),
      rubric: activity.rubric ? { rubricId: activity.rubric.rubricId, rubricVersion: activity.rubric.rubricVersion, criteria: [...activity.rubric.learnerVisibleCriteria] } : null,
      expectedDurationMinutes: activity.expectedDurationMinutes,
      collaborationMode: activity.collaborationMode,
      evidenceIntent: { kind: activity.evidenceIntent.kind, forms: [...activity.evidenceIntent.forms] },
      accessibility: { ...activity.accessibility, alternativeFormatResourceIds: onlyLearner(activity.accessibility.alternativeFormatResourceIds) },
    })),
    assessments: bundle.assessments.map((assessment) => ({
      identity: { ...assessment.identity },
      role: assessment.role,
      title: assessment.title,
      objectiveIds: [...assessment.objectiveIds],
      definition: { definitionId: assessment.definition.definitionId, definitionVersion: assessment.definition.definitionVersion },
      itemOrder: assessment.itemOrder.kind === "FIXED" ? ("FIXED" as const) : ("RANDOMIZED" as const),
      learnerInstructions: [...assessment.learnerInstructions],
    })),
    labs: bundle.labs.map((lab) => ({
      identity: { ...lab.identity },
      link: { linkId: lab.link.linkId, linkRevision: lab.link.linkRevision },
      lab: { labId: lab.lab.labId, labVersion: lab.lab.labVersion },
      objectiveIds: [...lab.objectiveIds],
      role: lab.role,
      placement: { lessonItemId: lab.placement.lessonItemId, sceneId: lab.placement.sceneId },
      authorityBasis: lab.authorityBasis,
    })),
    resources: bundle.resources
      .filter((resource) => resource.audience === "LEARNER")
      .map((resource) => ({ resourceId: resource.resourceId, resourceVersion: resource.resourceVersion, kind: resource.kind, title: resource.title, locale: resource.locale, assetId: resource.assetId })),
    tools: bundle.toolkitBindings
      .filter((binding): binding is typeof binding & { mode: "REQUIRED" | "OPTIONAL" } => binding.mode !== "PROHIBITED")
      .map((binding) => ({ toolId: binding.toolId, mode: binding.mode, scope: binding.scope.kind === "ITEM" ? { kind: "ITEM" as const, itemId: binding.scope.itemId } : { kind: "BUNDLE" as const }, configuration: { ...binding.configuration }, context: binding.context })),
    toolkitMapping: bundle.toolkitMapping ? { mappingId: bundle.toolkitMapping.mappingId, mappingVersion: bundle.toolkitMapping.mappingVersion } : null,
    learnerSupport: {
      remediation: bundle.learnerSupport.remediation.map(supportLink),
      enrichment: bundle.learnerSupport.enrichment.map(supportLink),
      accommodations: bundle.learnerSupport.accommodations.map((a) => ({ accommodationId: a.accommodationId, kind: a.kind, presentation: { ...a.presentation } })),
      languageVariants: bundle.learnerSupport.languageVariants.map((v) => ({ locale: v.locale, itemId: v.itemId, resourceIds: onlyLearner(v.resourceIds) })),
    },
    renderings: bundle.renderings
      .filter((rendering) => rendering.audience === "LEARNER" && LEARNER_RENDERING_KINDS.has(rendering.kind))
      .map((rendering) => ({ renderingId: rendering.renderingId, kind: rendering.kind, artifactVersion: rendering.artifactVersion, artifactSha256: rendering.artifactSha256 })),
    offline: {
      audience: "LEARNER",
      projectionVersion: LEARNER_PROJECTION_VERSION,
      bundleId: bundle.identity.bundleId,
      bundleVersion: bundle.identity.version,
      contentHash,
      releaseIdentity: bundle.curriculumAuthority.releaseIdentity,
      packageable: bundle.offline.packageable,
      members: [...bundle.lessons, ...bundle.activities, ...bundle.assessments, ...bundle.labs]
        .map((member) => ({ itemId: member.identity.itemId, itemVersion: member.identity.itemVersion, itemKind: member.identity.itemKind }))
        .sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0)),
      assets: bundle.offline.assets
        .filter((asset) => learnerAssets.has(asset.assetId))
        .map((asset) => ({ assetId: asset.assetId, assetVersion: asset.assetVersion, sha256: asset.sha256, byteSize: asset.byteSize, mediaType: asset.mediaType })),
      allowedCapabilities: [...bundle.offline.allowedCapabilities],
      reconnectSemantics: { requiredFor: [...bundle.offline.reconnectSemantics.requiredFor], maxOfflineDays: bundle.offline.reconnectSemantics.maxOfflineDays },
    },
  };
}

/** Validate, seal and project untrusted input. Fails closed with structured errors. */
export function projectLearnerContentBundle(
  input: unknown,
  options?: ContentBundleValidationOptions,
): Readonly<{ ok: true; learnerBundle: LearnerContentBundle; errors: readonly ContentBundleValidationError[] }> | Readonly<{ ok: false; learnerBundle: null; errors: readonly ContentBundleValidationError[] }> {
  const sealed = sealContentBundle(input, options);
  if (sealed.ok === false) return { ok: false, learnerBundle: null, errors: sealed.errors };
  return { ok: true, learnerBundle: projectLearnerBundle(sealed.sealed.bundle, sealed.sealed.contentHash), errors: [] };
}

/**
 * Resolve the GovernedContentRef for an item in a validated bundle. Returns null for an unknown
 * item rather than guessing, so callers cannot mint references to content the bundle lacks.
 */
export function governedContentRef(bundle: ContentBundleV1, itemId: string): GovernedContentRef | null {
  const identity: BundleItemIdentity<GovernedItemKind> | undefined =
    bundle.lessons.find((l) => l.identity.itemId === itemId)?.identity ??
    bundle.activities.find((a) => a.identity.itemId === itemId)?.identity ??
    bundle.assessments.find((a) => a.identity.itemId === itemId)?.identity ??
    bundle.labs.find((l) => l.identity.itemId === itemId)?.identity;
  if (!identity) return null;
  return { bundleId: bundle.identity.bundleId, bundleVersion: bundle.identity.version, itemId: identity.itemId, itemVersion: identity.itemVersion, itemKind: identity.itemKind };
}
