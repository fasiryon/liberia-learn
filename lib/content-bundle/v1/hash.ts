/**
 * Deterministic content identity for ContentBundle V1.
 *
 * CONTENT HASH vs GOVERNED RELEASE IDENTITY
 *   - The content hash identifies WHAT IS LEARNED: exact member versions, sequence and
 *     meaningful authored order, objective bindings, curriculum authority references (releaseId,
 *     releaseIdentity, source/concept/construct pins), resource versions, assessment definition
 *     and item versions, lab binding identity, the pinned toolkit mapping, learner support
 *     references, the offline asset identities and composition provenance.
 *   - Governed release identity is separate. `curriculumAuthority.releaseIdentity` pins the
 *     ontology release the content is composed against (and is hashed as a reference). Reviews,
 *     lifecycle events and release records are attestations about a sealed
 *     (bundleId, version, contentHash). They are not hashed, so recording an approval never changes
 *     what was approved.
 *
 * Excluded: `identity.contentHash` (self), derived `renderings` (output artifacts compiled from
 * the hashed content), and `governance.reviewRefs` / `lifecycleRefs` / `releaseRefs`. The contract
 * has no timestamps, notes or student state, and the validator rejects them.
 *
 * Governed activityReferences are hashed as exact pointers; their authority-restored display
 * payloads are excluded. Legacy embedded fixture activities retain their original hash semantics.
 * Serialization reuses the curriculum canonical JSON (sorted object keys, normalized numbers).
 * Unordered sets (id lists and id-keyed collections) are sorted. Sequence follows explicit `order`.
 * Authored order is kept where it is meaningful: instruction steps, FIXED assessment item order,
 * rubric criteria and learner instructions.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { ContentBundleV1 } from "./types";

export const CONTENT_BUNDLE_HASH_DOMAIN = "liberialearn.content-bundle.v1.sha256" as const;

const sorted = (values: readonly string[]): string[] => [...values].sort();
const byKey = <T>(values: readonly T[], key: (value: T) => string): T[] => [...values].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
const byOrder = <T extends { order: number }>(values: readonly T[]): T[] => [...values].sort((a, b) => a.order - b.order);

function normalizeSupportLink<T extends { objectiveIds: readonly string[]; itemIds: readonly string[]; resourceIds: readonly string[] }>(link: T): T {
  return { ...link, objectiveIds: sorted(link.objectiveIds), itemIds: sorted(link.itemIds), resourceIds: sorted(link.resourceIds) };
}

/** The exact semantic payload that is hashed. Exposed for audit and debugging. */
export function contentBundleHashPayload(bundle: ContentBundleV1) {
  const { bundleId, version, title, gradeLevel, subject, locale } = bundle.identity;
  const authority = bundle.curriculumAuthority;
  return {
    domain: CONTENT_BUNDLE_HASH_DOMAIN,
    schemaVersion: bundle.schemaVersion,
    identity: { bundleId, version, title, gradeLevel, subject, locale },
    curriculumAuthority: {
      releaseId: authority.releaseId,
      releaseIdentity: authority.releaseIdentity,
      objectiveIds: sorted(authority.objectiveIds),
      standardIds: sorted(authority.standardIds),
      sourceVersionRefs: sorted(authority.sourceVersionRefs),
      conceptRefs: sorted(authority.conceptRefs),
      constructBindingRefs: sorted(authority.constructBindingRefs),
    },
    sequence: {
      units: byOrder(bundle.sequence.units).map((unit) => ({
        ...unit,
        prerequisiteUnitIds: sorted(unit.prerequisiteUnitIds),
        entries: byOrder(unit.entries).map((entry) => ({
          ...entry,
          prerequisiteItemIds: sorted(entry.prerequisiteItemIds),
          unlocksItemIds: sorted(entry.unlocksItemIds),
        })),
      })),
    },
    lessons: byKey(bundle.lessons, (l) => l.identity.itemId).map((lesson) => ({
      ...lesson,
      objectiveIds: sorted(lesson.objectiveIds),
      resourceIds: sorted(lesson.resourceIds),
    })),
    ...(bundle.activityReferences ? { activityReferences: byKey(bundle.activityReferences, a => a.activityId) } : {}),
    activities: byKey(bundle.activities.filter(a => !bundle.activityReferences?.some(ref => ref.activityId === a.identity.itemId)), (a) => a.identity.itemId).map((activity) => ({
      ...activity,
      objectiveIds: sorted(activity.objectiveIds),
      lessonItemIds: sorted(activity.lessonItemIds),
      resourceIds: sorted(activity.resourceIds),
      instructions: {
        learner: activity.instructions.learner.map((step) => ({ ...step, resourceIds: sorted(step.resourceIds) })),
        teacher: activity.instructions.teacher.map((step) => ({ ...step, resourceIds: sorted(step.resourceIds) })),
      },
      evidenceIntent: { ...activity.evidenceIntent, forms: sorted(activity.evidenceIntent.forms) },
      accessibility: { ...activity.accessibility, alternativeFormatResourceIds: sorted(activity.accessibility.alternativeFormatResourceIds) },
    })),
    assessments: byKey(bundle.assessments, (a) => a.identity.itemId).map((assessment) => ({
      ...assessment,
      objectiveIds: sorted(assessment.objectiveIds),
      // FIXED: authored order is semantic. RANDOMIZED_BY_POLICY: the policy is hashed, items are a set.
      items: assessment.itemOrder.kind === "FIXED" ? assessment.items : byKey(assessment.items, (item) => item.assessmentItemId),
    })),
    labs: byKey(bundle.labs, (l) => l.identity.itemId).map((lab) => ({ ...lab, objectiveIds: sorted(lab.objectiveIds) })),
    resources: byKey(bundle.resources, (r) => r.resourceId),
    toolkitBindings: byKey(bundle.toolkitBindings, (b) => `${b.toolId}|${b.scope.kind === "ITEM" ? `ITEM:${b.scope.itemId}` : "BUNDLE"}`),
    toolkitMapping: bundle.toolkitMapping,
    learnerSupport: {
      remediation: byKey(bundle.learnerSupport.remediation, (s) => s.supportId).map(normalizeSupportLink),
      enrichment: byKey(bundle.learnerSupport.enrichment, (s) => s.supportId).map(normalizeSupportLink),
      accommodations: byKey(bundle.learnerSupport.accommodations, (a) => a.accommodationId),
      languageVariants: byKey(bundle.learnerSupport.languageVariants, (v) => `${v.itemId}|${v.locale}`).map((variant) => ({ ...variant, resourceIds: sorted(variant.resourceIds) })),
    },
    offline: {
      packageable: bundle.offline.packageable,
      assets: byKey(bundle.offline.assets, (a) => a.assetId),
      allowedCapabilities: sorted(bundle.offline.allowedCapabilities),
      reconnectSemantics: { ...bundle.offline.reconnectSemantics, requiredFor: sorted(bundle.offline.reconnectSemantics.requiredFor) },
    },
    provenanceRefs: sorted(bundle.governance.provenanceRefs),
    extensions: bundle.extensions ?? null,
  };
}

/** SHA-256 (lowercase hex) of the canonical semantic payload. Expects a structurally valid bundle. */
export function hashContentBundle(bundle: ContentBundleV1): string {
  return createHash("sha256").update(canonicalizeJson(contentBundleHashPayload(bundle)), "utf8").digest("hex");
}
