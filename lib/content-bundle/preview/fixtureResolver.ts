/**
 * Fixture adapter for the Teacher Preview resolver seam. NOT AUTHORITY.
 *
 * It validates, seals and projects a registered fixture bundle with the merged ContentBundle V1
 * foundation, then reports every fact it cannot know (release state, lab certification, toolkit
 * mapping review) as not evaluated. Wave 2B replaces it with a resolver over governed storage.
 */
import { sealContentBundle } from "../v1/seal";
import { projectLearnerBundle } from "../v1/projection";
import { checkToolkitMapping, type ToolkitMapping } from "../v1/toolkitMapping";
import type { ContentBundleV1 } from "../v1/types";
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_IDS, G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING } from "../v1/fixtures/grade4FractionsFixture";
import type { ContentBundlePreviewResolver, LabReadiness } from "./resolver";

export type FixtureRegistration = Readonly<{ build: () => ContentBundleV1; mapping: ToolkitMapping | null; label: string }>;

export type RuntimeToolCatalog = Readonly<Record<string, string>>;

const PREVIEW_ROLES: ReadonlySet<string> = new Set(["TEACHER", "ADMIN"]);

export const DEFAULT_PREVIEW_FIXTURES: Readonly<Record<string, FixtureRegistration>> = {
  [G4_FRACTIONS_FIXTURE_IDS.bundleId]: {
    build: buildGrade4FractionsFixture,
    mapping: G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING,
    label: "Synthetic Grade 4 fractions test fixture (not curriculum, not reviewed, not released)",
  },
};

const LAB_NOT_EVALUATED: LabReadiness = {
  state: "NOT_EVALUATED",
  reason: "The fixture adapter does not consult the certified lab registry or link governance, so this lab cannot be shown as runnable.",
};

export function createFixturePreviewResolver(options: Readonly<{ fixtures?: Readonly<Record<string, FixtureRegistration>>; runtimeTools?: RuntimeToolCatalog }> = {}): ContentBundlePreviewResolver {
  const fixtures = options.fixtures ?? DEFAULT_PREVIEW_FIXTURES;
  const runtimeTools = options.runtimeTools ?? {};
  return {
    async resolveForTeacherPreview(request) {
      const unavailable = (code: string) => ({ status: "UNAVAILABLE" as const, bundle: null, learnerProjection: null, diagnostics: [{ code, path: "preview" }] });
      if (!PREVIEW_ROLES.has(request.viewer.role) || !request.viewer.schoolId || (request.schoolId && request.schoolId !== request.viewer.schoolId)) return unavailable("PREVIEW_FORBIDDEN");
      const registration = Object.prototype.hasOwnProperty.call(fixtures, request.bundleId) ? fixtures[request.bundleId] : undefined;
      if (!registration) return unavailable("COMPOSITION_MISSING");
      const sealed = sealContentBundle(registration.build());
      if (sealed.ok === false) return { status: "INCOMPATIBLE", bundle: null, learnerProjection: null, diagnostics: sealed.errors.map(e => ({ code: e.code, path: e.path })) };
      const { bundle, contentHash } = sealed.sealed;
      if (request.bundleVersion !== null && request.bundleVersion !== bundle.identity.version) return unavailable("COMPOSITION_MISSING");

      const mapping = registration.mapping;
      const runtimeIds = mapping ? [...new Set(Object.values(mapping.entries).flat())] : [];
      return {
        status: "RESOLVED",
        source: { kind: "FIXTURE", label: registration.label, authoritative: false },
        bundle,
        contentHash,
        diagnostics: [],
        authorityMetadata: { readiness: "BLOCKED", objectiveDescriptions: {}, offlinePackageClosed: false },
        learnerProjection: projectLearnerBundle(bundle, contentHash),
        labReadiness: Object.fromEntries(bundle.labs.map((lab) => [lab.identity.itemId, LAB_NOT_EVALUATED])),
        release: { state: "NOT_EVALUATED", reason: "No release authority was consulted. A fixture is never a curriculum release." },
        toolkit: {
          // Fixture mappings are unreviewed by definition; review is a governance fact, not a fixture claim.
          mapping: mapping ? { mappingId: mapping.mappingId, mappingVersion: mapping.mappingVersion, reviewed: false, entries: mapping.entries } : null,
          runtimeToolNames: Object.fromEntries(runtimeIds.filter((id) => Object.prototype.hasOwnProperty.call(runtimeTools, id)).map((id) => [id, runtimeTools[id]])),
          issues: mapping ? checkToolkitMapping(bundle, mapping, (id) => Object.prototype.hasOwnProperty.call(runtimeTools, id)) : [],
        },
      };
    },
  };
}
