// @vitest-environment jsdom
/**
 * Activity Wave V1: governed ActivityDefinition authority + Grade 4 fractions experiences.
 * Synthetic candidate authority only; nothing here is approval, release or curriculum.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => { throw new Error("Activity wave must not load database access"); });

import { createGrade4FractionsCandidateAuthority, CANDIDATE_ACTIVITY_LIFECYCLE } from "@/lib/activity-definition/v1/fixtures/grade4FractionsCandidateAuthority";
import { hashActivityDefinition } from "@/lib/activity-definition/v1/hash";
import { parseActivityDefinition } from "@/lib/activity-definition/v1/validator";
import { resolveActivityDefinition } from "@/lib/activity-definition/v1/resolver";
import type { ActivityDefinitionV1 } from "@/lib/activity-definition/v1/types";
import { resolveContentBundle } from "@/lib/content-bundle/v1/resolver";
import { hashContentBundle } from "@/lib/content-bundle/v1/hash";
import { validateContentBundle } from "@/lib/content-bundle/v1/validator";
import { createFixturePreviewResolver } from "@/lib/content-bundle/preview/fixtureResolver";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import type { ResolvedContentBundlePreview } from "@/lib/content-bundle/preview/resolver";
import { ContentBundlePreview, type PreviewMode } from "@/components/teacher/content-bundle-preview/ContentBundlePreview";

type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const viewer = { userId: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const PROFILES = { PRACTICE_GUIDED: "GUIDED_PRACTICE", PRACTICE_INDEPENDENT: "INDEPENDENT_PRACTICE", CLASSWORK_null: "CLASSWORK", HOMEWORK_null: "HOMEWORK" } as Record<string, string>;
const context = (a: ReturnType<typeof createGrade4FractionsCandidateAuthority>, d: ActivityDefinitionV1, requireReleased: boolean) => ({
  activityId: d.activityId, version: d.version,
  authorityContext: { reader: a.activityAuthority, releaseId: a.composition.curriculumAuthority.releaseId, releaseIdentity: a.composition.curriculumAuthority.releaseIdentity, revision: a.pins[d.activityId], requireReleased },
});
const editable = (d: ActivityDefinitionV1) => structuredClone(d) as Mutable<ActivityDefinitionV1>;

async function preview(): Promise<ResolvedContentBundlePreview> {
  const a = createGrade4FractionsCandidateAuthority();
  const r = await createFixturePreviewResolver().resolveForTeacherPreview({ bundleId: a.ids.bundleId, bundleVersion: null, viewer });
  if (r.status !== "RESOLVED") throw new Error(`expected RESOLVED, got ${r.status}: ${JSON.stringify(r.diagnostics)}`);
  return r;
}

describe("four G4 activities as governed ActivityDefinition V1", () => {
  it("each has exact identity, kind, objectives, instructions, resources, duration, collaboration, evidence intent, experience, hash and governance refs", () => {
    const a = createGrade4FractionsCandidateAuthority();
    expect(a.definitions).toHaveLength(4);
    for (const d of a.definitions) {
      expect(parseActivityDefinition(structuredClone(d))).not.toBeNull();
      expect(d.contentHash).toBe(hashActivityDefinition(d));
      expect(d.version).toBe("1.1.0-fixture");
      expect(d.content.objectiveIds.length).toBeGreaterThan(0);
      expect(d.content.instructions.learner.length).toBeGreaterThan(0);
      expect(d.content.instructions.teacher.length).toBeGreaterThan(0);
      expect(d.content.expectedDurationMinutes).toBeGreaterThan(0);
      expect(d.content.experience?.schema).toBe("activity-experience.v1");
      expect(d.content.experience?.profile).toBe(PROFILES[`${d.kind}_${d.content.scaffolding}`]);
      for (const id of d.content.resourceIds) expect(d.resources.some((r) => r.resourceId === id)).toBe(true);
      // Candidate: provenance only, never review/lifecycle/release records.
      expect(d.governance).toEqual({ provenanceRefs: ["fixture.provenance.synthetic"], reviewRefs: [], lifecycleRefs: [], releaseRefs: [] });
    }
    expect(a.definitions.map((d) => [d.kind, d.content.collaborationMode, d.content.evidenceIntent.kind])).toEqual([
      ["PRACTICE", "INDIVIDUAL", "PRACTICE_ONLY"],
      ["PRACTICE", "INDIVIDUAL", "PRACTICE_ONLY"],
      ["CLASSWORK", "PAIR", "FORMATIVE"],
      ["HOMEWORK", "INDIVIDUAL", "PRACTICE_ONLY"],
    ]);
  });

  it("guided and independent are both PRACTICE, distinguished only by governed content", () => {
    const [guided, independent] = createGrade4FractionsCandidateAuthority().definitions;
    expect([guided.kind, independent.kind]).toEqual(["PRACTICE", "PRACTICE"]);
    expect([guided.content.scaffolding, independent.content.scaffolding]).toEqual(["GUIDED", "INDEPENDENT"]);
    expect(guided.content.experience!.learner.workedExamples.length).toBeGreaterThan(0);
    expect(guided.content.experience!.learner.items.every((i) => i.hints.length >= 2)).toBe(true);
    expect(independent.content.experience!.learner.workedExamples).toHaveLength(0);
    expect(independent.content.experience!.learner.items.every((i) => i.hints.length <= 1)).toBe(true);
  });

  it("hashes the experience as activity content", () => {
    const d = editable(createGrade4FractionsCandidateAuthority().definitions[0]);
    const before = hashActivityDefinition(d as ActivityDefinitionV1);
    d.content.experience!.learner.items[0].hints[0] = "A different hint";
    expect(hashActivityDefinition(d as ActivityDefinitionV1)).not.toBe(before);
  });

  it("rejects answer keys, student state, unknown fields and kind/profile mismatches inside the governed definition", () => {
    const [guided, independent] = createGrade4FractionsCandidateAuthority().definitions;
    const withKey = editable(guided); (withKey.content.experience!.learner.items[0] as Record<string, unknown>).correctAnswer = "1/4";
    const withState = editable(guided); (withState.content.experience as Record<string, unknown>).mastery = 1;
    const withTeacherKey = editable(guided); (withTeacherKey.content.experience!.teacher as Record<string, unknown>).answerKey = "x";
    const swapped = editable(independent); swapped.content.experience = editable(guided).content.experience;
    const viaExtensions = editable(guided); (viaExtensions.content as Record<string, unknown>).extensions = { experience: guided.content.experience };
    for (const bad of [withKey, withState, withTeacherKey, swapped, viaExtensions]) expect(parseActivityDefinition(bad)).toBeNull();
  });
});

describe("ContentBundle → activityId + version → ActivityDefinition authority", () => {
  it("composes the bundle from exact pointers, with no duplicated activity payload", () => {
    const a = createGrade4FractionsCandidateAuthority();
    expect(a.composition.activities).toEqual([]);
    expect(a.composition.activityReferences).toEqual(a.definitions.map((d) => ({ activityId: d.activityId, version: d.version, kind: d.kind })));
    expect(validateContentBundle(a.composition).ok).toBe(true);
    const duplicated = { ...a.composition, activities: a.revisions[a.definitions[0].activityId].member ? [a.revisions[a.definitions[0].activityId].member] : [] };
    expect(validateContentBundle(duplicated).ok).toBe(false);
  });

  it("restores candidates in draft inspection and the release gate refuses them (PENDING_REVIEW, not released)", async () => {
    const a = createGrade4FractionsCandidateAuthority();
    expect(a.release.contentBindings.some((b) => b.contentType === "ACTIVITY")).toBe(false);
    for (const d of a.definitions) {
      expect(a.revisions[d.activityId].lifecycleState).toBe(CANDIDATE_ACTIVITY_LIFECYCLE);
      expect((await resolveActivityDefinition(context(a, d, false))).status).toBe("RESOLVED");
      expect(await resolveActivityDefinition(context(a, d, true))).toMatchObject({ status: "INCOMPATIBLE", definition: null, diagnostics: [{ code: "ACTIVITY_NOT_APPROVED" }] });
    }
  });

  it("approval alone is not release: an APPROVED revision without a release binding is still refused", async () => {
    const a = createGrade4FractionsCandidateAuthority();
    const d = a.definitions[0];
    a.revisions[d.activityId] = { ...a.revisions[d.activityId], lifecycleState: "APPROVED" };
    expect((await resolveActivityDefinition(context(a, d, true))).diagnostics[0].code).toBe("ACTIVITY_NOT_RELEASED");
  });

  it("the production bundle resolver refuses the candidate composition", async () => {
    const a = createGrade4FractionsCandidateAuthority();
    const result = await resolveContentBundle(a.input, a.reader);
    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.bundle).toBeNull();
    expect(result.diagnostics[0].code).toBe("ACTIVITY_NOT_APPROVED");
  });

  it("fails closed when the activity authority is absent, storage is missing or the payload is stale", async () => {
    const a = createGrade4FractionsCandidateAuthority();
    expect((await resolveContentBundle(a.input, { ...a.reader, activityAuthority: undefined })).diagnostics[0].code).toBe("ACTIVITY_AUTHORITY_MISSING");
    const missing = createGrade4FractionsCandidateAuthority(); missing.activityAuthority.readActivity = async () => null;
    expect((await resolveActivityDefinition(context(missing, missing.definitions[0], false))).diagnostics[0].code).toBe("ACTIVITY_MISSING");
    const stale = createGrade4FractionsCandidateAuthority();
    (stale.definitions[1] as Mutable<ActivityDefinitionV1>).content.experience!.learner.goal = "tampered";
    expect((await resolveActivityDefinition(context(stale, stale.definitions[1], false))).diagnostics[0].code).toBe("ACTIVITY_HASH_STALE");
  });
});

describe("Teacher Preview over the authority path", () => {
  it("restores all four activities with authority readiness and a pointer-only bundle hash", async () => {
    const r = await preview();
    const a = createGrade4FractionsCandidateAuthority();
    expect(r.bundle.activityReferences).toHaveLength(4);
    expect(r.bundle.activities.map((m) => m.identity.itemId)).toEqual(a.definitions.map((d) => d.activityId));
    // Payloads are not part of the bundle hash; the exact version pointers are.
    expect(r.contentHash).toBe(hashContentBundle(a.composition));
    for (const d of a.definitions) {
      expect(r.activityReadiness?.[d.activityId]).toEqual({ source: "ACTIVITY_DEFINITION_AUTHORITY", activityHash: d.contentHash, lifecycleState: "PENDING_REVIEW", releaseEligible: false, releaseGate: "ACTIVITY_NOT_APPROVED" });
    }
    expect(r.source).toMatchObject({ kind: "FIXTURE", authoritative: false });
    expect(r.release.state).toBe("NOT_EVALUATED");
    expect(r.toolkit.mapping?.reviewed).toBe(false);
  });

  it("projects only learner-safe activity data", async () => {
    const r = await preview();
    const json = JSON.stringify(r.learnerProjection);
    for (const s of ["lookFors", "misconceptions", "evidenceNote", "alignment", "phases", "\"teacher\"", "Classwork scoring guide", "Classwork facilitation guide", "Listen to each pair", "PENDING_REVIEW", "fixture.provenance", "internalConfiguration"]) expect(json).not.toContain(s);
    for (const activity of r.learnerProjection.activities) {
      expect(activity.experience).toBeTruthy();
      expect(activity.accessibility).toBeTruthy();
      expect(Object.keys(activity)).not.toContain("governance");
    }
    expect(r.learnerProjection.activities.find((x) => x.rubric)?.rubric).toEqual({ rubricId: "fixture.rubric.g4-math.share-bottle-caps-classwork", rubricVersion: "1.1.0-fixture", criteria: expect.any(Array) });
  });

  it("production refuses the fixture bundle", async () => {
    const r = await getContentBundlePreviewResolver({ NODE_ENV: "production" }).resolveForTeacherPreview({ bundleId: "fixture.bundle.g4-math-fractions-activities", bundleVersion: null, viewer, fixturePreview: true });
    expect(r).toMatchObject({ status: "UNAVAILABLE", diagnostics: [{ code: "FIXTURE_NOT_AUTHORITY" }] });
  });
});

let root: Root | null = null;
let host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root!.unmount()); root = null; host?.remove(); });
async function render(mode: PreviewMode, itemId: string) {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  const models = buildPreviewModels(await preview());
  await act(async () => { root!.render(<ContentBundlePreview models={models} initialMode={mode} initialItemId={itemId} />); });
}

describe("Teacher Preview rendering of authority state", () => {
  it.each(["guided-practice", "independent-practice", "classwork", "homework"])("teacher sees authority source, review state and release gate for %s; student does not", async (suffix) => {
    const id = `fixture.activity.g4-math.fractions.${suffix}`;
    await render("teacher", id);
    expect(host.querySelector("[data-testid=activity-authority]")?.textContent).toContain("Restored from the ActivityDefinition authority");
    expect(host.querySelector("[data-testid=activity-lifecycle]")?.textContent).toBe("Pending review");
    expect(host.querySelector("[data-testid=activity-release-gate]")?.textContent).toContain("Not releasable");
    act(() => root!.unmount()); root = null; host.remove();
    await render("student", id);
    const frame = host.querySelector("[data-testid=student-preview]")!.textContent!;
    for (const s of ["ActivityDefinition authority", "Pending review", "Not releasable", "Release gate"]) expect(frame).not.toContain(s);
    expect(host.querySelector("[data-testid=learner-experience]")).toBeTruthy();
  });
});
