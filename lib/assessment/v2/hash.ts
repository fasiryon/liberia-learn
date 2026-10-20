/**
 * Deterministic, domain-separated hashing for Assessment V2 content.
 *
 * - The scoring spec hash covers the protected material (keys, tolerances, rubric, explanation).
 * - The item hash covers learner-visible content AND the scoring spec hash, so editing a key,
 *   tolerance or rubric produces a new item hash and invalidates any approval bound to the old one.
 * - The form hash covers the definition pin, the ordered item pins (with their hashes and points),
 *   delivery rules and the scoring blueprint.
 * - The release hash covers every exact binding a release authorizes.
 *
 * Attestations (reviews, releases, revocations) are never part of the content they attest to.
 * Serialization reuses the curriculum canonical JSON (sorted keys, normalized numbers).
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type {
  AssessmentDefinitionV2,
  AssessmentFormV2,
  AssessmentItemV2,
  AssessmentReleaseV2,
  ProtectedScoringSpec,
} from "./types";

export const ASSESSMENT_HASH_DOMAINS = {
  definition: "liberialearn.assessment.v2.definition.sha256",
  item: "liberialearn.assessment.v2.item.sha256",
  scoringSpec: "liberialearn.assessment.v2.scoring-spec.sha256",
  form: "liberialearn.assessment.v2.form.sha256",
  release: "liberialearn.assessment.v2.release.sha256",
} as const;

function digest(domain: string, payload: unknown): string {
  return createHash("sha256").update(canonicalizeJson({ domain, payload }), "utf8").digest("hex");
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

export function hashScoringSpec(spec: ProtectedScoringSpec): string {
  return digest(ASSESSMENT_HASH_DOMAINS.scoringSpec, spec);
}

export function definitionHashPayload(definition: Omit<AssessmentDefinitionV2, "contentHash"> | AssessmentDefinitionV2) {
  const { contentHash: _ignored, ...rest } = definition as AssessmentDefinitionV2;
  return {
    ...rest,
    objectiveIds: sorted(rest.objectiveIds),
    prerequisiteObjectiveIds: sorted(rest.prerequisiteObjectiveIds),
    permittedAccommodations: sorted(rest.permittedAccommodations),
    permittedTools: [...rest.permittedTools].sort((a, b) => (a.toolId < b.toolId ? -1 : a.toolId > b.toolId ? 1 : 0)),
    alignment: {
      ...rest.alignment,
      nationalObjectiveIds: sorted(rest.alignment.nationalObjectiveIds),
      extensionObjectiveIds: sorted(rest.alignment.extensionObjectiveIds),
    },
  };
}

export function hashDefinition(definition: Omit<AssessmentDefinitionV2, "contentHash"> | AssessmentDefinitionV2): string {
  return digest(ASSESSMENT_HASH_DOMAINS.definition, definitionHashPayload(definition));
}

/** Options, ordering elements and matching columns keep authored order: it is what learners see. */
export function itemHashPayload(item: Omit<AssessmentItemV2, "itemHash"> | AssessmentItemV2) {
  const { itemHash: _ignored, ...rest } = item as AssessmentItemV2;
  return {
    ...rest,
    objectiveIds: sorted(rest.objectiveIds),
    misconceptionIds: sorted(rest.misconceptionIds),
    stimulus: { ...rest.stimulus, resourceIds: sorted(rest.stimulus.resourceIds) },
  };
}

export function hashItem(item: Omit<AssessmentItemV2, "itemHash"> | AssessmentItemV2): string {
  return digest(ASSESSMENT_HASH_DOMAINS.item, itemHashPayload(item));
}

export function hashForm(form: Omit<AssessmentFormV2, "formHash"> | AssessmentFormV2): string {
  const { formHash: _ignored, ...rest } = form as AssessmentFormV2;
  const items = rest.delivery.itemOrder === "FIXED"
    ? rest.items
    : [...rest.items].sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  return digest(ASSESSMENT_HASH_DOMAINS.form, {
    ...rest,
    items,
    blueprint: {
      ...rest.blueprint,
      objectiveCoverage: [...rest.blueprint.objectiveCoverage].sort((a, b) => (a.objectiveId < b.objectiveId ? -1 : 1)),
    },
  });
}

export function hashRelease(release: Omit<AssessmentReleaseV2, "releaseHash"> | AssessmentReleaseV2): string {
  const { releaseHash: _ignored, ...rest } = release as AssessmentReleaseV2;
  return digest(ASSESSMENT_HASH_DOMAINS.release, {
    ...rest,
    objectiveIds: sorted(rest.objectiveIds),
    permittedModes: sorted(rest.permittedModes),
    items: [...rest.items].sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0)),
  });
}

/** Builders that stamp the computed hash, so callers never hand-write one. */
export function sealDefinition(definition: Omit<AssessmentDefinitionV2, "contentHash">): AssessmentDefinitionV2 {
  return Object.freeze({ ...definition, contentHash: hashDefinition(definition) });
}

export function sealItem(item: Omit<AssessmentItemV2, "itemHash" | "scoringSpecHash">, spec: ProtectedScoringSpec): AssessmentItemV2 {
  if (spec.itemId !== item.itemId || spec.itemVersion !== item.version) throw new Error("assessment_spec_item_mismatch");
  const withSpec = { ...item, scoringSpecHash: hashScoringSpec(spec) };
  return Object.freeze({ ...withSpec, itemHash: hashItem(withSpec) });
}

export function sealForm(form: Omit<AssessmentFormV2, "formHash">): AssessmentFormV2 {
  return Object.freeze({ ...form, formHash: hashForm(form) });
}

export function sealRelease(release: Omit<AssessmentReleaseV2, "releaseHash">): AssessmentReleaseV2 {
  return Object.freeze({ ...release, releaseHash: hashRelease(release) });
}
