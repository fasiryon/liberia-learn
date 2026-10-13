/** Server-constructed authority only; no mutation capabilities or current-version fallback. */
import { canonicalizeJson, hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { deterministicReleaseIdentity, validateOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { ContentBundleAuthorityReader, ResolvedRevision, RevisionPin } from "@/lib/content-bundle/v1/resolver";
import type { RubricReference } from "@/lib/content-bundle/v1/types";
import { hashActivityDefinition } from "./hash";
import { activityBundleMember, type ActivityDefinitionV1, type ActivityRecord, type ActivityReference } from "./types";
import { exactIdentity, parseActivityDefinition } from "./validator";

export interface ActivityAuthorityReader extends Pick<ContentBundleAuthorityReader, "readRelease" | "readInventory" | "readCurriculumAuthority" | "readResource" | "readRevision"> {
  readActivity(ref: Readonly<{ activityId: string; version: string }>): Promise<ActivityRecord | null>;
  /** Exact approved rubric restored from existing governance, including resource audience. */
  readRubric(ref: RubricReference): Promise<RubricReference | null>;
}
export type ActivityAuthorityContext = Readonly<{
  reader: ActivityAuthorityReader;
  releaseId: string;
  releaseIdentity: string;
  revision?: RevisionPin;
  /** False permits draft inspection only. It does not establish bundle eligibility. */
  requireReleased?: boolean;
}>;
export type ActivityResolution = Readonly<{
  status: "RESOLVED" | "UNAVAILABLE" | "INCOMPATIBLE";
  definition: ActivityDefinitionV1 | null;
  diagnostics: readonly Readonly<{ code: string; path: string }>[];
}>;
const equal = (a: unknown, b: unknown) => canonicalizeJson(a) === canonicalizeJson(b);
const fail = (status: "UNAVAILABLE" | "INCOMPATIBLE", code: string, path = "activity"): ActivityResolution => ({ status, definition: null, diagnostics: [{ code, path }] });

export async function resolveActivityDefinition(input: Readonly<{ activityId: string; version: string; authorityContext: ActivityAuthorityContext }>): Promise<ActivityResolution> {
  if (!input || typeof input.activityId !== "string" || typeof input.version !== "string" || !exactIdentity(input.activityId) || !exactIdentity(input.version)) return fail("INCOMPATIBLE", "EXACT_IDENTITY_REQUIRED");
  try {
    const context = input.authorityContext;
    const reader = context.reader;
    const record = await reader.readActivity({ activityId: input.activityId, version: input.version });
    if (!record) return fail("UNAVAILABLE", "ACTIVITY_MISSING");
    const definition = parseActivityDefinition(structuredClone(record.definition));
    if (!definition) return fail("INCOMPATIBLE", "ACTIVITY_INVALID");
    if (definition.activityId !== input.activityId || definition.version !== input.version) return fail("INCOMPATIBLE", "ACTIVITY_VERSION_MISMATCH");
    if (hashActivityDefinition(definition) !== definition.contentHash) return fail("INCOMPATIBLE", "ACTIVITY_HASH_STALE");
    if (definition.release.releaseId !== context.releaseId || definition.release.releaseIdentity !== context.releaseIdentity) return fail("INCOMPATIBLE", "RELEASE_IDENTITY_MISMATCH");
    const revision: ResolvedRevision | null = await reader.readRevision(record.revision);
    if (!revision) return fail("UNAVAILABLE", "ACTIVITY_REVISION_MISSING");
    const actualPin = { revisionId: revision.revisionId, provenanceId: revision.provenanceId, contentHash: revision.contentHash };
    if (!equal(record.revision, actualPin) || (context.revision && !equal(context.revision, actualPin)) || !definition.governance.provenanceRefs.includes(revision.provenanceId)) return fail("INCOMPATIBLE", "PROVENANCE_REVISION_MISMATCH");
    if (hashCurriculumSnapshot(revision.snapshotSchemaVersion, revision.snapshot) !== revision.contentHash) return fail("INCOMPATIBLE", "REVISION_HASH_MISMATCH");
    const snapshot = revision.snapshot as { activityDefinition?: unknown } | null;
    if (!snapshot || !equal(snapshot.activityDefinition ?? null, definition) || !equal(revision.member, activityBundleMember(definition))) return fail("INCOMPATIBLE", "ACTIVITY_SNAPSHOT_MISMATCH");
    if (revision.provenanceCompleteness !== "VERIFIED") return fail("INCOMPATIBLE", "PROVENANCE_UNVERIFIED");
    if (context.requireReleased !== false && revision.lifecycleState !== "APPROVED") return fail("INCOMPATIBLE", "ACTIVITY_NOT_APPROVED");
    if (!["DRAFT", "PENDING_REVIEW", "APPROVED"].includes(revision.lifecycleState)) return fail("INCOMPATIBLE", "ACTIVITY_LIFECYCLE_INELIGIBLE");
    const release = await reader.readRelease(context.releaseId);
    if (!release) return fail("UNAVAILABLE", "RELEASE_MISSING");
    if (context.requireReleased !== false && (release.status !== "PUBLISHED" || release.reviewStatus !== "APPROVED")) return fail("INCOMPATIBLE", "RELEASE_NOT_APPROVED_PUBLISHED");
    try { validateOntologyRelease(release); } catch { return fail("INCOMPATIBLE", "RELEASE_INVALID"); }
    if (deterministicReleaseIdentity(release) !== context.releaseIdentity || !definition.governance.provenanceRefs.includes(release.provenanceRef)) return fail("INCOMPATIBLE", "RELEASE_PROVENANCE_MISMATCH");
    const inventory = await reader.readInventory(release);
    const authority = await reader.readCurriculumAuthority(release);
    if (!inventory || inventory.releaseId !== release.id || inventory.releaseIdentity !== context.releaseIdentity || !authority || authority.releaseId !== release.id || authority.releaseIdentity !== context.releaseIdentity) return fail("INCOMPATIBLE", "INVENTORY_UNRESOLVED");
    for (const objective of definition.content.objectiveIds) {
      if (!authority.objectiveIds.includes(objective) || !inventory.concepts.some(concept => concept.objectiveId === objective)) return fail("INCOMPATIBLE", "OBJECTIVE_MISSING");
      if (context.requireReleased !== false && !release.contentBindings.some(binding => binding.contentType === "ACTIVITY" && binding.contentId === definition.activityId && binding.contentVersion === definition.version && binding.contentSha256 === definition.contentHash && inventory.concepts.some(concept => concept.conceptId === binding.conceptId && concept.objectiveId === objective))) return fail("INCOMPATIBLE", "ACTIVITY_NOT_RELEASED");
    }
    if (new Set(definition.lessonBindings.map(l => l.lessonId)).size !== definition.lessonBindings.length || !equal([...definition.content.lessonItemIds].sort(), definition.lessonBindings.map(l => l.lessonId).sort())) return fail("INCOMPATIBLE", "LESSON_BINDING_INVALID");
    for (const lesson of definition.lessonBindings) if (!inventory.lessons.some(l => l.contentId === lesson.lessonId && l.version === lesson.version)) return fail("INCOMPATIBLE", "LESSON_VERSION_UNRESOLVED");
    const resources = new Map(definition.resources.map(resource => [resource.resourceId, resource]));
    if (resources.size !== definition.resources.length) return fail("INCOMPATIBLE", "RESOURCE_DUPLICATE");
    for (const resource of definition.resources) if (!equal(resource, await reader.readResource(resource))) return fail("INCOMPATIBLE", "RESOURCE_VERSION_UNRESOLVED");
    const content = definition.content;
    const learnerIds = [...content.instructions.learner.flatMap(step => step.resourceIds), ...content.accessibility.alternativeFormatResourceIds];
    const allIds = [...content.resourceIds, ...learnerIds, ...content.instructions.teacher.flatMap(step => step.resourceIds)];
    if (allIds.some(id => !resources.has(id)) || learnerIds.some(id => resources.get(id)?.audience !== "LEARNER" || ["ANSWER_KEY", "SCORING_GUIDE", "TEACHER_NOTE"].includes(resources.get(id)!.kind))) return fail("INCOMPATIBLE", "RESOURCE_REFERENCE_INVALID");
    if (content.rubric) {
      if (!equal(content.rubric, await reader.readRubric(content.rubric))) return fail("INCOMPATIBLE", "RUBRIC_VERSION_UNRESOLVED");
      const guide = content.rubric.scoringGuideResourceId;
      if (guide && (!resources.has(guide) || resources.get(guide)?.audience === "LEARNER" || resources.get(guide)?.kind !== "SCORING_GUIDE")) return fail("INCOMPATIBLE", "RUBRIC_RESOURCE_INVALID");
    }
    return { status: "RESOLVED", definition, diagnostics: [] };
  } catch { return fail("UNAVAILABLE", "AUTHORITY_READ_FAILED", "authority"); }
}

export function matchesActivityReference(ref: ActivityReference, definition: ActivityDefinitionV1): boolean {
  return ref.activityId === definition.activityId && ref.version === definition.version && ref.kind === definition.kind;
}
