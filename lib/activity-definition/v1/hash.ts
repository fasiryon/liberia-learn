import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { ActivityDefinitionV1 } from "./types";

const sorted = (values: readonly string[]) => [...values].sort();
export function activityDefinitionHashPayload(activity: ActivityDefinitionV1) {
  const { contentHash: _hash, governance, ...semantic } = activity;
  const content = activity.content;
  return {
    domain: "liberialearn.activity-definition.v1.sha256", ...semantic,
    // The enclosing release hashes its activity binding digest. Hashing that release digest
    // back into the activity would create a cycle. Verify it separately against the revision.
    release: { releaseId: activity.release.releaseId },
    content: {
      ...content, objectiveIds: sorted(content.objectiveIds), lessonItemIds: sorted(content.lessonItemIds), resourceIds: sorted(content.resourceIds),
      instructions: Object.fromEntries(Object.entries(content.instructions).map(([audience, steps]) => [audience, steps.map(step => ({ ...step, resourceIds: sorted(step.resourceIds) }))])),
      evidenceIntent: { ...content.evidenceIntent, forms: sorted(content.evidenceIntent.forms) },
      accessibility: { ...content.accessibility, alternativeFormatResourceIds: sorted(content.accessibility.alternativeFormatResourceIds) },
    },
    resources: [...activity.resources].sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0),
    lessonBindings: [...activity.lessonBindings].sort((a, b) => a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0),
    provenanceRefs: sorted(governance.provenanceRefs),
  };
}
export function hashActivityDefinition(activity: ActivityDefinitionV1): string {
  return createHash("sha256").update(canonicalizeJson(activityDefinitionHashPayload(activity)), "utf8").digest("hex");
}
