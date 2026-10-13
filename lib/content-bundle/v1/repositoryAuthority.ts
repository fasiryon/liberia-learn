/** Repository authority adapter; no database access or write capabilities.
 * Durable exact composition/revision/resource/source adapters remain server-owned dependencies.
 * The legacy provenance explanation reader resolves currentRevision and is deliberately NOT used
 * as an exact historical revision reader. Neither generation flags nor candidates are authority.
 */
import { publishedRelease } from "@/lib/learning-authority/publishedReleases";
import { deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { governedInventoryForRelease, resolveObjective } from "@/lib/learning-authority/governedInventoryRuntime";
import { isCanonicalToolId } from "@/lib/curriculum/v2/tools";
import type { ContentBundleAuthorityReader, ResolverDiagnostic } from "./resolver";

export type ExactStoredAuthorityReaders = Pick<ContentBundleAuthorityReader,
  "readComposition" | "readRevision" | "readResource" | "readAsset" | "readRendering" | "readCurriculumAuthority" | "activityAuthority">;

export function createRepositoryContentBundleReader(stored: ExactStoredAuthorityReaders): ContentBundleAuthorityReader {
  return {
    activityAuthority: stored.activityAuthority,
    readComposition: input => stored.readComposition(input),
    readRevision: pin => stored.readRevision(pin),
    readResource: ref => stored.readResource(ref),
    readAsset: ref => stored.readAsset(ref),
    readRendering: ref => stored.readRendering(ref),
    readCurriculumAuthority: release => stored.readCurriculumAuthority(release),
    readRelease: async id => publishedRelease(id),
    readInventory: async release => governedInventoryForRelease(release),
    // No reviewed AssessmentDefinition registry or semantic mapping at this base. Raw release
    // items have real identities, but do not constitute an independently governed definition.
    readAssessment: async () => null,
    readToolkitMapping: async () => null,
    isRuntimeToolId: isCanonicalToolId,
  };
}

const RELEASE = "lr-moe-g4-math-fractions-2026.1";
const OBJECTIVE = "moe-math-g4-s1-p3-number-theory-and-fraction-obj4";

/** Repository-only readiness proof: keyless references, no fabricated bundle version/hash.
 * PARTIAL means some dependencies resolve, NOT that a classroom bundle can be delivered.
 */
export function grade4FractionsReadiness() {
  const diagnostics: ResolverDiagnostic[] = [];
  const gap = (code: string, path: string) => diagnostics.push({ code, path });
  const release = publishedRelease(RELEASE);
  if (!release) return { status: "BLOCKED" as const, bundle: null, available: null, diagnostics: [{ code: "RELEASE_MISSING", path: RELEASE }] };
  const inventory = governedInventoryForRelease(release);
  const objective = resolveObjective(inventory, OBJECTIVE);
  gap("COMPOSITION_MISSING", "bundle");
  gap("SOURCE_VERSION_RIGHTS_UNVERIFIED", OBJECTIVE);
  for (const lesson of inventory.lessons) {
    const binding = release.contentBindings.find(b => b.contentId === lesson.contentId && b.contentVersion === lesson.version);
    if (!binding?.contentSha256) gap("LESSON_PAYLOAD_HASH_MISSING", lesson.contentId);
    gap("EXACT_APPROVED_REVISION_UNVERIFIED", lesson.contentId);
  }
  if (objective.status !== "GOVERNED") gap("OBJECTIVE_NOT_GOVERNED", OBJECTIVE);
  gap("SET_SPECIFIC_ASSESSMENT_BANK_GAP", OBJECTIVE);
  gap("ASSESSMENT_DEFINITION_MISSING", "assessments");
  gap("MISSING_GOVERNED_ITEM_IDENTITY", "legacy.lesson.assessment");
  gap("ANSWER_BEARING_LEGACY_STORE", "legacy.lesson.assessment");
  gap("ASSESSMENT_VERSION_PIN_MISSING", "legacy.lesson.assessment");
  gap("ACTIVITY_DEFINITION_REVISION_GAP", "activities");
  gap("TOOLKIT_MAPPING_UNRESOLVED", "fraction_strips");
  gap("LAB_REVISION_CERTIFICATION_UNRESOLVED", "labs");
  gap("RESOURCE_MEDIA_REVISION_GAP", "resources");
  gap("OFFLINE_PACKAGE_GAP", "offline");
  return {
    status: "PARTIAL" as const, bundle: null,
    available: {
      releaseId: release.id, releaseIdentity: deterministicReleaseIdentity(release),
      authority: release.authority, moeApprovalState: inventory.moeApprovalState,
      objectiveId: OBJECTIVE, objectiveStatus: objective.status,
      lessons: inventory.lessons.map(l => ({ contentId: l.contentId, version: l.version })),
      items: release.items.map(i => ({ itemId: i.id, itemVersion: i.version, context: i.context })),
      conceptRefs: release.concepts.map(c => ({ conceptId: c.id, revision: c.revision })),
      constructBindingRefs: release.bindings.map(b => b.id),
      certifiedLabs: [] as readonly string[],
    },
    diagnostics,
  };
}
