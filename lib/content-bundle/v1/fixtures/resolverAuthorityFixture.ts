/** SYNTHETIC TEST AUTHORITY ONLY. No publication, writes or production review evidence.
 * Used by integration tests and the local browser harness to exercise real resolver gates.
 * Production entry points never register this reader.
 */
import { createHash } from "crypto";
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING } from "./grade4FractionsFixture";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { governedInventoryForRelease } from "@/lib/learning-authority/governedInventoryRuntime";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { isCanonicalToolId } from "@/lib/curriculum/v2/tools";
import type { ContentBundleAuthorityReader, ResolvedRevision } from "../resolver";
import type { ContentBundleV1 } from "../types";

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };

export function createSyntheticResolverAuthority() {
  const bundle = structuredClone(buildGrade4FractionsFixture()) as Mutable<ContentBundleV1>;
  // Integration tests use a non-fixture navigation alias; the release and version still identify
  // synthetic material. Server integration must detect and label it, including alias attempts.
  bundle.identity.bundleId = "test.bundle.synthetic-resolver";
  bundle.identity.subject = GRADE4_MATH_ONTOLOGY_RELEASE.subject;
  const payload = { synthetic: true, learnerText: "Equal parts" };
  const items = bundle.assessments.flatMap(a => a.items);
  const release = {
    ...structuredClone(GRADE4_MATH_ONTOLOGY_RELEASE), id: "fixture.release.synthetic-integration", provenanceRef: "fixture.provenance.synthetic",
    items: items.map(i => ({ ...GRADE4_MATH_ONTOLOGY_RELEASE.items[0], id: i.assessmentItemId, version: i.assessmentItemVersion })),
    bindings: items.map((i, n) => ({ ...GRADE4_MATH_ONTOLOGY_RELEASE.bindings[0], id: `fixture.binding.${n}`, itemId: i.assessmentItemId, itemVersion: i.assessmentItemVersion })),
    contentBindings: [{ ...GRADE4_MATH_ONTOLOGY_RELEASE.contentBindings[0], contentId: bundle.lessons[0].identity.itemId, contentVersion: bundle.lessons[0].identity.itemVersion, contentSha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex") }],
  };
  const inventory = {
    ...governedInventoryForRelease(GRADE4_MATH_ONTOLOGY_RELEASE), releaseId: release.id, releaseIdentity: deterministicReleaseIdentity(release),
    lessons: [{ contentId: bundle.lessons[0].identity.itemId, version: bundle.lessons[0].identity.itemVersion, conceptIds: release.concepts.map(c => c.id), objectiveIds: bundle.curriculumAuthority.objectiveIds, toolPolicyId: release.toolPolicies[0].id }],
    concepts: bundle.curriculumAuthority.objectiveIds.map(objectiveId => ({ conceptId: release.concepts[0].id, objectiveId, objectiveBasis: "MOE_OBJECTIVE" as const, prerequisiteConceptIds: [] })),
  };
  bundle.curriculumAuthority = { ...bundle.curriculumAuthority, releaseId: release.id, releaseIdentity: inventory.releaseIdentity, conceptRefs: release.concepts.map(c => c.id), constructBindingRefs: release.bindings.map(b => b.id) };
  const revisions: Record<string, ResolvedRevision> = {};
  for (const member of [...bundle.lessons, ...bundle.activities, ...bundle.assessments]) {
    const snapshot = { payload, member };
    revisions[member.identity.itemId] = { revisionId: `fixture.revision.${member.identity.itemId}`, provenanceId: "fixture.provenance.synthetic", contentHash: hashCurriculumSnapshot(1, snapshot), snapshotSchemaVersion: 1, lifecycleState: "APPROVED", provenanceCompleteness: "VERIFIED", snapshot, member: structuredClone(member), releasePayload: payload };
  }
  const pins = Object.fromEntries(Object.entries(revisions).map(([id, r]) => [id, { revisionId: r.revisionId, provenanceId: r.provenanceId, contentHash: r.contentHash }]));
  const reader: ContentBundleAuthorityReader = {
    readComposition: async () => ({ manifest: bundle, revisions: pins }),
    readRelease: async () => release,
    readInventory: async () => inventory,
    readCurriculumAuthority: async () => bundle.curriculumAuthority,
    readRevision: async pin => Object.values(revisions).find(r => r.revisionId === pin.revisionId) ?? null,
    readAssessment: async ref => {
      const a = bundle.assessments.find(a => a.definition.definitionId === ref.definitionId);
      return a ? { definition: a.definition, items: a.items, itemOrder: a.itemOrder, scoring: "SINGLE_CHOICE_SERVER", source: "RELEASE_ITEMS" } : null;
    },
    readResource: async ref => ref, readAsset: async ref => ref, readRendering: async ref => ref,
    readToolkitMapping: async () => G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING,
    isRuntimeToolId: isCanonicalToolId,
  };
  return { bundle, release, inventory, revisions, pins, reader, input: { bundleId: bundle.identity.bundleId, bundleVersion: bundle.identity.version } };
}
