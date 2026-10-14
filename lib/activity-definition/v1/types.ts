import type { ActivityDefinition, ActivityKind, GovernanceReferences, ResourceReference } from "@/lib/content-bundle/v1/types";
import type { RevisionPin } from "@/lib/content-bundle/v1/resolver";

export type ActivityReference = Readonly<{ activityId: string; version: string; kind: ActivityKind }>;
/** Content only. Lifecycle is replayed from existing exact-revision governance. */
export type ActivityDefinitionV1 = ActivityReference & Readonly<{
  schemaVersion: "activity-definition.v1";
  contentHash: string;
  content: Omit<ActivityDefinition, "identity" | "extensions">;
  resources: readonly ResourceReference[];
  lessonBindings: readonly Readonly<{ lessonId: string; version: string }>[];
  release: Readonly<{ releaseId: string; releaseIdentity: string }>;
  governance: GovernanceReferences;
}>;
export type ActivityRecord = Readonly<{ definition: unknown; revision: RevisionPin }>;

export function activityBundleMember(definition: ActivityDefinitionV1): ActivityDefinition {
  return { identity: { itemId: definition.activityId, itemVersion: definition.version, itemKind: definition.kind }, ...definition.content };
}
