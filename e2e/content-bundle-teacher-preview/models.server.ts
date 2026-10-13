/**
 * Runs in Node (Vite SSR loader), never in the browser: seals and projects the merged Grade 4
 * fractions fixture through the real resolver seam, then hands the browser display models only.
 * The "lab" variant adds one test-only lab binding to exercise the non-runnable lab state.
 */
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_IDS as ids, G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING } from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import { createFixturePreviewResolver } from "@/lib/content-bundle/preview/fixtureResolver";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { TOOL_REGISTRY_DEFINITIONS } from "@/lib/toolkit/toolRegistry";
import { createSyntheticResolverAuthority } from "@/lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import { teacherDiagnosticMessages } from "@/lib/content-bundle/preview/diagnostics";
import type { ContentBundlePreviewResolution } from "@/lib/content-bundle/preview/resolver";

const viewer = { userId: "fixture-teacher", role: "TEACHER", schoolId: "fixture-school" };

export async function buildHarnessModels() {
  const synthetic = createSyntheticResolverAuthority();
  const integrated = getContentBundlePreviewResolver({ NODE_ENV: "test" }, {
    canPreviewBundle: async (scope, id) => scope.schoolId === viewer.schoolId && id === synthetic.input.bundleId,
    createReader: () => synthetic.reader,
  });
  const main = await integrated.resolveForTeacherPreview({ ...synthetic.input, viewer });
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
  const unavailable = await getContentBundlePreviewResolver({ NODE_ENV: "production" }).resolveForTeacherPreview({ bundleId: "g4-math-fractions", bundleVersion: "1.0.0", viewer });
  synthetic.bundle.identity.contentHash = "0".repeat(64);
  const incompatible = await integrated.resolveForTeacherPreview({ ...synthetic.input, viewer });
  synthetic.bundle.identity.contentHash = null;
  synthetic.bundle.labs = [{ identity: { itemId: "fixture.lab", itemVersion: "1", itemKind: "LAB" }, link: { linkId: "fixture.link", linkRevision: "fixture.claim-only" }, lab: { labId: "fixture.lab", labVersion: "1" }, objectiveIds: synthetic.bundle.curriculumAuthority.objectiveIds, role: "OPTIONAL", placement: { lessonItemId: synthetic.bundle.lessons[0].identity.itemId, sceneId: null }, authorityBasis: "GOVERNED_LINK" }];
  synthetic.bundle.sequence.units[0].entries.push({ itemId: "fixture.lab", order: 7, requirement: "OPTIONAL", prerequisiteItemIds: [], unlocksItemIds: [] });
  const labBlocked = await integrated.resolveForTeacherPreview({ ...synthetic.input, viewer });
  const state = (r: ContentBundlePreviewResolution) => ({
    title: r.status === "INCOMPATIBLE" ? "Bundle cannot safely be resolved" : "Content unavailable for preview",
    message: r.status === "INCOMPATIBLE" ? "This bundle cannot safely be resolved. Its content is withheld." : "This content is not currently available for preview.",
    diagnostics: teacherDiagnosticMessages(r.diagnostics), readiness: r.authorityMetadata?.readiness,
  });
  return { default: buildPreviewModels(main), lab: buildPreviewModels(lab), states: { unavailable: state(unavailable), incompatible: state(incompatible), labBlocked: state(labBlocked) } };
}
