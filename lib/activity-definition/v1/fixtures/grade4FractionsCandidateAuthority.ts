/**
 * SYNTHETIC CANDIDATE ACTIVITY AUTHORITY. Test and local-harness only; production entry points
 * never register it. No publication, writes or review evidence.
 *
 * Stores the four Grade 4 fractions activity experiences (grade4FractionsActivitiesFixture.ts) as
 * governed ActivityDefinitionV1 records, and composes the activities bundle from exact
 * `activityReferences` instead of embedded payloads:
 *
 *   ContentBundle → activityId + version → resolveActivityDefinition → ActivityDefinitionV1
 *   → bundle member (activityBundleMember) → learner projection / Teacher Preview
 *
 * Truthful candidate state:
 *   - every activity revision is PENDING_REVIEW (never APPROVED);
 *   - the release carries NO ACTIVITY content binding for them (they are not released);
 *   - the ontology release, inventory and lesson revisions are the existing synthetic integration
 *     authority (createSyntheticResolverAuthority), labelled synthetic and never authoritative.
 * So the production bundle resolver (requireReleased) rejects these activities, and only the
 * explicit draft-inspection mode used by the fixture preview restores them.
 */
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { createSyntheticResolverAuthority } from "@/lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import { buildGrade4FractionsActivitiesFixture, G4_FRACTIONS_ACTIVITIES_FIXTURE_IDS } from "@/lib/content-bundle/v1/fixtures/grade4FractionsActivitiesFixture";
import type { ContentBundleAuthorityReader, ResolvedRevision, RevisionPin } from "@/lib/content-bundle/v1/resolver";
import type { ActivityDefinition, ContentBundleV1, RubricReference } from "@/lib/content-bundle/v1/types";
import { hashActivityDefinition } from "../hash";
import type { ActivityAuthorityReader } from "../resolver";
import { activityBundleMember, type ActivityDefinitionV1, type ActivityReference } from "../types";

export const CANDIDATE_ACTIVITY_LIFECYCLE = "PENDING_REVIEW" as const;
const PROVENANCE = "fixture.provenance.synthetic";

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };

function toDefinition(member: ActivityDefinition, bundle: ContentBundleV1): ActivityDefinitionV1 {
  const { identity, extensions: _extensions, ...content } = member;
  const resourceIds = new Set([
    ...content.resourceIds,
    ...content.instructions.learner.flatMap((s) => s.resourceIds),
    ...content.instructions.teacher.flatMap((s) => s.resourceIds),
    ...content.accessibility.alternativeFormatResourceIds,
    ...(content.rubric?.scoringGuideResourceId ? [content.rubric.scoringGuideResourceId] : []),
  ]);
  const definition: Omit<ActivityDefinitionV1, "contentHash"> & { contentHash: string } = {
    schemaVersion: "activity-definition.v1",
    activityId: identity.itemId,
    version: identity.itemVersion,
    kind: identity.itemKind,
    contentHash: "",
    content,
    resources: bundle.resources.filter((r) => resourceIds.has(r.resourceId)),
    lessonBindings: content.lessonItemIds.map((lessonId) => ({ lessonId, version: bundle.lessons.find((l) => l.identity.itemId === lessonId)!.identity.itemVersion })),
    release: { releaseId: bundle.curriculumAuthority.releaseId, releaseIdentity: bundle.curriculumAuthority.releaseIdentity },
    governance: { provenanceRefs: [PROVENANCE], reviewRefs: [], lifecycleRefs: [], releaseRefs: [] },
  };
  definition.contentHash = hashActivityDefinition(definition as ActivityDefinitionV1);
  return definition as ActivityDefinitionV1;
}

export function createGrade4FractionsCandidateAuthority() {
  const base = createSyntheticResolverAuthority();
  const authored = buildGrade4FractionsActivitiesFixture();

  // The activities bundle sits on the synthetic integration authority (same fixture objectives).
  const bundle = structuredClone(authored) as Mutable<ContentBundleV1>;
  bundle.curriculumAuthority = structuredClone(base.bundle.curriculumAuthority);
  const definitions = authored.activities.map((member) => toDefinition(member, bundle as ContentBundleV1));

  const revisions: Record<string, ResolvedRevision> = { ...base.revisions };
  const pins: Record<string, RevisionPin> = { ...base.pins };
  for (const definition of definitions) {
    const snapshot = { activityDefinition: structuredClone(definition) };
    const revision: ResolvedRevision = {
      revisionId: `fixture.revision.${definition.activityId}@${definition.version}`,
      provenanceId: PROVENANCE,
      contentHash: hashCurriculumSnapshot(1, snapshot),
      snapshotSchemaVersion: 1,
      lifecycleState: CANDIDATE_ACTIVITY_LIFECYCLE,
      provenanceCompleteness: "VERIFIED",
      snapshot,
      member: activityBundleMember(definition),
      releasePayload: null,
    };
    revisions[definition.activityId] = revision;
    pins[definition.activityId] = { revisionId: revision.revisionId, provenanceId: revision.provenanceId, contentHash: revision.contentHash };
  }

  // Composition: exact pointers only; no activity payload is duplicated into the bundle.
  const references: ActivityReference[] = definitions.map((d) => ({ activityId: d.activityId, version: d.version, kind: d.kind }));
  bundle.activities = [];
  bundle.activityReferences = references;
  const composition = bundle as ContentBundleV1;

  const resources = new Map(composition.resources.map((r) => [`${r.resourceId}@${r.resourceVersion}`, r]));
  const rubrics = new Map(definitions.flatMap((d) => (d.content.rubric ? [[`${d.content.rubric.rubricId}@${d.content.rubric.rubricVersion}`, d.content.rubric] as const] : [])));
  const readRevision = async (pin: RevisionPin) => Object.values(revisions).find((r) => r.revisionId === pin.revisionId) ?? null;
  const activityAuthority: ActivityAuthorityReader = {
    readActivity: async (ref) => {
      const definition = definitions.find((d) => d.activityId === ref.activityId && d.version === ref.version);
      return definition ? { definition: structuredClone(definition), revision: pins[definition.activityId] } : null;
    },
    readRevision,
    readRelease: base.reader.readRelease,
    readInventory: base.reader.readInventory,
    readCurriculumAuthority: async () => composition.curriculumAuthority,
    readResource: async (ref) => resources.get(`${ref.resourceId}@${ref.resourceVersion}`) ?? null,
    readRubric: async (ref: RubricReference) => {
      const stored = rubrics.get(`${ref.rubricId}@${ref.rubricVersion}`);
      return stored && canonicalizeJson(stored) === canonicalizeJson(ref) ? stored : null;
    },
  };
  const reader: ContentBundleAuthorityReader = {
    ...base.reader,
    activityAuthority,
    readComposition: async () => ({ manifest: composition, revisions: pins }),
    readCurriculumAuthority: async () => composition.curriculumAuthority,
    readRevision,
  };
  return {
    composition,
    definitions,
    references,
    revisions,
    pins,
    release: base.release,
    inventory: base.inventory,
    activityAuthority,
    /** Full ContentBundle authority reader (production gates) over the same synthetic records. */
    reader,
    input: { bundleId: composition.identity.bundleId, bundleVersion: composition.identity.version },
    ids: G4_FRACTIONS_ACTIVITIES_FIXTURE_IDS,
  };
}
