/**
 * Deterministic content identity for ContentBundle V1.
 *
 * Serialization reuses the curriculum canonical JSON (sorted object keys, normalized numbers) so
 * bundle hashes are computed the same way as curriculum snapshot hashes. Before serialization the
 * bundle is normalized so that semantically equal bundles hash equally:
 *
 *   - id-keyed collections (lessons, activities, resources, ...) are sorted by id;
 *   - set-valued id lists (objectiveIds, resourceIds, prerequisites, ...) are sorted;
 *   - sequence units and entries are sorted by their explicit `order`, so changing an order
 *     value changes the hash while re-emitting the same order does not;
 *   - authored sequences whose order IS meaning (instruction steps, assessment item order,
 *     rubric criteria, learner instructions) are kept as authored.
 *
 * Excluded from the hash (PROVISIONAL): `renderings` (derived artifacts compiled from the hashed
 * content; regenerating a textbook must not change bundle identity) and `governance` (review and
 * release records attach to a hash; recording an approval must not change what was approved).
 * The contract has no timestamps or student state, and the validator rejects them.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { validateContentBundle, type ContentBundleValidationOptions } from "./validator";
import type { ContentBundleV1, ContentBundleValidationError } from "./types";

export const CONTENT_BUNDLE_HASH_DOMAIN = "liberialearn.content-bundle.v1.sha256" as const;

const sorted = (values: readonly string[]): string[] => [...values].sort();
const byKey = <T>(values: readonly T[], key: (value: T) => string): T[] => [...values].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
const byOrder = <T extends { order: number }>(values: readonly T[]): T[] => [...values].sort((a, b) => a.order - b.order);

/** The exact semantic payload that is hashed. Exposed for audit and debugging. */
export function contentBundleHashPayload(bundle: ContentBundleV1) {
  return {
    domain: CONTENT_BUNDLE_HASH_DOMAIN,
    schemaVersion: bundle.schemaVersion,
    identity: bundle.identity,
    curriculumAuthority: {
      ...bundle.curriculumAuthority,
      objectiveIds: sorted(bundle.curriculumAuthority.objectiveIds),
      standardIds: sorted(bundle.curriculumAuthority.standardIds),
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
    activities: byKey(bundle.activities, (a) => a.identity.itemId).map((activity) => ({
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
    })),
    labs: byKey(bundle.labs, (l) => l.identity.itemId).map((lab) => ({ ...lab, objectiveIds: sorted(lab.objectiveIds) })),
    resources: byKey(bundle.resources, (r) => r.resourceId),
    toolkitBindings: byKey(bundle.toolkitBindings, (b) => `${b.toolId}|${b.scope.kind === "ITEM" ? `ITEM:${b.scope.itemId}` : "BUNDLE"}`),
    learnerSupport: {
      remediation: byKey(bundle.learnerSupport.remediation, (s) => s.supportId).map(normalizeSupportLink),
      enrichment: byKey(bundle.learnerSupport.enrichment, (s) => s.supportId).map(normalizeSupportLink),
      accommodations: byKey(bundle.learnerSupport.accommodations, (a) => a.accommodationId),
      languageVariants: byKey(bundle.learnerSupport.languageVariants, (v) => `${v.itemId}|${v.locale}`).map((variant) => ({ ...variant, resourceIds: sorted(variant.resourceIds) })),
    },
    offline: {
      ...bundle.offline,
      assets: byKey(bundle.offline.assets, (a) => a.assetId),
      capabilityRestrictions: sorted(bundle.offline.capabilityRestrictions),
      reconnectRequirement: { ...bundle.offline.reconnectRequirement, requiredFor: sorted(bundle.offline.reconnectRequirement.requiredFor) },
    },
    extensions: bundle.extensions ?? null,
  };
}

function normalizeSupportLink<T extends { objectiveIds: readonly string[]; itemIds: readonly string[]; resourceIds: readonly string[] }>(link: T): T {
  return { ...link, objectiveIds: sorted(link.objectiveIds), itemIds: sorted(link.itemIds), resourceIds: sorted(link.resourceIds) };
}

/** SHA-256 (lowercase hex) of the canonical semantic payload. Expects a validated bundle. */
export function hashContentBundle(bundle: ContentBundleV1): string {
  return createHash("sha256").update(canonicalizeJson(contentBundleHashPayload(bundle)), "utf8").digest("hex");
}

export type SealedContentBundle = Readonly<{ bundle: ContentBundleV1; contentHash: string }>;

/** Validate, then hash. Fails closed: an invalid bundle never receives a content identity. */
export function sealContentBundle(
  input: unknown,
  options?: ContentBundleValidationOptions,
): Readonly<{ ok: true; sealed: SealedContentBundle; errors: readonly ContentBundleValidationError[] }> | Readonly<{ ok: false; sealed: null; errors: readonly ContentBundleValidationError[] }> {
  const result = validateContentBundle(input, options);
  if (result.ok === false) return { ok: false, sealed: null, errors: result.errors };
  return { ok: true, sealed: { bundle: result.bundle, contentHash: hashContentBundle(result.bundle) }, errors: [] };
}
