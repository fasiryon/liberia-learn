/**
 * Runs in Node (Vite SSR loader), never in the browser: seals and projects the Grade 4 fractions
 * activity-experience fixture through the fixture resolver seam, then hands the browser display
 * models only.
 */
import { G4_FRACTIONS_ACTIVITIES_FIXTURE_IDS as ids } from "@/lib/content-bundle/v1/fixtures/grade4FractionsActivitiesFixture";
import { createFixturePreviewResolver } from "@/lib/content-bundle/preview/fixtureResolver";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { TOOL_REGISTRY_DEFINITIONS } from "@/lib/toolkit/toolRegistry";

export async function buildHarnessModels() {
  const resolved = await createFixturePreviewResolver({ runtimeTools: Object.fromEntries(TOOL_REGISTRY_DEFINITIONS.map((t) => [t.id, t.name])) })
    .resolveForTeacherPreview({ bundleId: ids.bundleId, bundleVersion: null, viewer: { userId: "fixture-teacher", role: "TEACHER", schoolId: "fixture-school" } });
  if (resolved.status !== "RESOLVED") throw new Error(`harness fixture did not resolve: ${resolved.status}`);
  return buildPreviewModels(resolved);
}
