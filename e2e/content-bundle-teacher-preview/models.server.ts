/**
 * Runs in Node (Vite SSR loader), never in the browser: seals and projects the merged Grade 4
 * fractions fixture through the real resolver seam, then hands the browser display models only.
 * The "lab" variant adds one test-only lab binding to exercise the non-runnable lab state.
 */
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_IDS as ids, G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING } from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import { createFixturePreviewResolver } from "@/lib/content-bundle/preview/fixtureResolver";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { buildPreviewModels, type ContentBundlePreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { TOOL_REGISTRY_DEFINITIONS } from "@/lib/toolkit/toolRegistry";

const viewer = { userId: "fixture-teacher", role: "TEACHER", schoolId: "fixture-school" };

export async function buildHarnessModels(): Promise<Record<"default" | "lab", ContentBundlePreviewModels>> {
  const main = await getContentBundlePreviewResolver({ NODE_ENV: "development" }).resolveForTeacherPreview({ bundleId: ids.bundleId, bundleVersion: null, viewer });
  const labFixture = () => {
    const base = buildGrade4FractionsFixture();
    return {
      ...base,
      sequence: { units: base.sequence.units.map((u) => ({ ...u, entries: [...u.entries, { itemId: "fixture.member.lab.test", order: 7, requirement: "OPTIONAL" as const, prerequisiteItemIds: [ids.lesson], unlocksItemIds: [] }] })) },
      labs: [{ identity: { itemId: "fixture.member.lab.test", itemVersion: "1", itemKind: "LAB" as const }, link: { linkId: "fixture.link.test", linkRevision: "3" }, lab: { labId: "fixture.lab.test", labVersion: "1.0.0" }, objectiveIds: [ids.objectives.partsOfSet], role: "CORE" as const, placement: { lessonItemId: ids.lesson, sceneId: "scene-3" }, authorityBasis: "GOVERNED_LINK" as const }],
    };
  };
  const lab = await createFixturePreviewResolver({
    fixtures: { [ids.bundleId]: { build: labFixture, mapping: G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING, label: "Test-only lab variant of the synthetic Grade 4 fixture" } },
    runtimeTools: Object.fromEntries(TOOL_REGISTRY_DEFINITIONS.map((t) => [t.id, t.name])),
  }).resolveForTeacherPreview({ bundleId: ids.bundleId, bundleVersion: null, viewer });
  if (main.status !== "RESOLVED" || lab.status !== "RESOLVED") throw new Error("harness fixture did not resolve");
  return { default: buildPreviewModels(main), lab: buildPreviewModels(lab) };
}
