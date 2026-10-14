/**
 * Teacher Preview seam over the governed ActivityDefinition authority.
 *
 * A composition stores exact `activityReferences`; this restores each payload through
 * `resolveActivityDefinition` in explicit draft-inspection mode (requireReleased: false), so a
 * teacher can preview candidate content. Release eligibility is NOT inferred: each activity is also
 * run through the release gate (requireReleased: true) and the gate's own answer is reported.
 * Preview restoration never makes a bundle resolvable by the production resolver.
 */
import { matchesActivityReference, resolveActivityDefinition, type ActivityAuthorityReader } from "@/lib/activity-definition/v1/resolver";
import { activityBundleMember } from "@/lib/activity-definition/v1/types";
import type { RevisionPin } from "../v1/resolver";
import type { ContentBundleV1 } from "../v1/types";

export type ActivityAuthorityReadiness = Readonly<{
  /** Where the activity payload came from. */
  source: "ACTIVITY_DEFINITION_AUTHORITY";
  activityHash: string;
  lifecycleState: string;
  /** True only when the release gate itself resolves the activity. */
  releaseEligible: boolean;
  /** Release-gate diagnostic when not eligible (e.g. ACTIVITY_NOT_APPROVED). */
  releaseGate: string | null;
}>;

export type ActivityHydration =
  | Readonly<{ ok: true; bundle: ContentBundleV1; readiness: Readonly<Record<string, ActivityAuthorityReadiness>> }>
  | Readonly<{ ok: false; status: "UNAVAILABLE" | "INCOMPATIBLE"; diagnostics: readonly Readonly<{ code: string; path: string }>[] }>;

export async function hydrateActivityReferencesForPreview(composition: ContentBundleV1, pins: Readonly<Record<string, RevisionPin>>, reader: ActivityAuthorityReader): Promise<ActivityHydration> {
  const refs = composition.activityReferences ?? [];
  if (composition.activities.some((a) => refs.some((r) => r.activityId === a.identity.itemId))) return { ok: false, status: "INCOMPATIBLE", diagnostics: [{ code: "ACTIVITY_PAYLOAD_DUPLICATED", path: "activities" }] };
  const members = [];
  const readiness: Record<string, ActivityAuthorityReadiness> = {};
  for (const ref of refs) {
    const pin = pins[ref.activityId];
    if (!pin) return { ok: false, status: "INCOMPATIBLE", diagnostics: [{ code: "ITEM_REVISION_MISSING", path: `activityReferences.${ref.activityId}` }] };
    const context = { reader, releaseId: composition.curriculumAuthority.releaseId, releaseIdentity: composition.curriculumAuthority.releaseIdentity, revision: pin };
    const draft = await resolveActivityDefinition({ activityId: ref.activityId, version: ref.version, authorityContext: { ...context, requireReleased: false } });
    if (draft.status !== "RESOLVED" || !draft.definition) return { ok: false, status: draft.status === "UNAVAILABLE" ? "UNAVAILABLE" : "INCOMPATIBLE", diagnostics: draft.diagnostics };
    if (!matchesActivityReference(ref, draft.definition)) return { ok: false, status: "INCOMPATIBLE", diagnostics: [{ code: "ACTIVITY_BUNDLE_BINDING_MISMATCH", path: `activityReferences.${ref.activityId}` }] };
    const gate = await resolveActivityDefinition({ activityId: ref.activityId, version: ref.version, authorityContext: { ...context, requireReleased: true } });
    const revision = await reader.readRevision(pin);
    readiness[ref.activityId] = {
      source: "ACTIVITY_DEFINITION_AUTHORITY",
      activityHash: draft.definition.contentHash,
      lifecycleState: revision?.lifecycleState ?? "UNKNOWN",
      releaseEligible: gate.status === "RESOLVED",
      releaseGate: gate.status === "RESOLVED" ? null : gate.diagnostics[0]?.code ?? gate.status,
    };
    members.push(activityBundleMember(draft.definition));
  }
  return { ok: true, bundle: { ...composition, activities: [...composition.activities, ...members] }, readiness };
}
