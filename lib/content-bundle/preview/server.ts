/** Read-only server integration. Never import into a client component. */
import { assertSchoolAccess } from "@/lib/tenant/assert-school-access";
import { resolveContentBundle, type ContentBundleAuthorityReader, type ResolverDiagnostic } from "../v1/resolver";
import { createRepositoryContentBundleReader, grade4FractionsReadiness } from "../v1/repositoryAuthority";
import { TOOL_REGISTRY_DEFINITIONS } from "@/lib/toolkit/toolRegistry";
import type { CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { GovernedCellInventory } from "@/lib/learning-authority/governedInventory";
import type { ToolkitMapping } from "../v1/toolkitMapping";
import type { ContentBundlePreviewResolver, PreviewAuthorityMetadata, PreviewSource } from "./resolver";

export type PreviewSchoolScope = Readonly<{ schoolId: string; userId: string; role: "TEACHER" | "ADMIN" }>;
export type PreviewDependencies = Readonly<{
  /** Authorize bundle membership before constructing sensitive readers. */
  canPreviewBundle(scope: PreviewSchoolScope, bundleId: string): Promise<boolean>;
  /** Every stored read must include this school scope; no global/current-row fallback. */
  createReader(scope: PreviewSchoolScope): ContentBundleAuthorityReader;
  source?: PreviewSource;
}>;

// A known national readiness slice, not allocation of a production bundle identity.
const repositoryDependencies: PreviewDependencies = {
  canPreviewBundle: async (_scope, id) => id === "g4-math-fractions",
  createReader: (_scope) => createRepositoryContentBundleReader({
    // No immutable composition store or reviewed exact stored adapters at this base.
    // Null is truthful; no DB queries, current revision fallback, writes or fabricated pins.
    readComposition: async () => null, readRevision: async () => null,
    readCurriculumAuthority: async () => null, readResource: async () => null,
    readAsset: async () => null, readRendering: async () => null,
  }),
};

function objectiveDescriptions(release: CurriculumOntologyRelease | null, inventory: GovernedCellInventory | null) {
  if (!release || !inventory) return {};
  const descriptions: Record<string, string> = {};
  for (const concept of inventory.concepts) {
    const label = release.concepts.find(c => c.id === concept.conceptId)?.label;
    if (label) descriptions[concept.objectiveId] = `Ontology concept: ${label}`;
  }
  return descriptions;
}

export function getContentBundlePreviewResolver(
  env: Readonly<{ NODE_ENV?: string }> = process.env,
  dependencies: PreviewDependencies = repositoryDependencies,
): ContentBundlePreviewResolver {
  return {
    async resolveForTeacherPreview(request) {
      const unavailable = (diagnostics: readonly ResolverDiagnostic[], authorityMetadata?: PreviewAuthorityMetadata) => ({ status: "UNAVAILABLE" as const, bundle: null, learnerProjection: null, diagnostics, authorityMetadata });
      const viewer = request.viewer;
      // Trusted session role + school are mandatory, including platform admins on this surface.
      if (!["TEACHER", "ADMIN"].includes(viewer.role) || !viewer.userId || !viewer.schoolId || (request.schoolId !== undefined && request.schoolId !== viewer.schoolId)) return unavailable([{ code: "PREVIEW_FORBIDDEN", path: "preview" }]);
      await assertSchoolAccess({ id: viewer.userId, role: viewer.role as "TEACHER" | "ADMIN", schoolId: viewer.schoolId, isPlatformAdmin: false }, request.schoolId ?? viewer.schoolId);
      const scope: PreviewSchoolScope = { schoolId: viewer.schoolId, userId: viewer.userId, role: viewer.role as "TEACHER" | "ADMIN" };
      if (request.bundleId.startsWith("fixture.")) {
        if (env.NODE_ENV === "production" || !request.fixturePreview) return unavailable([{ code: "FIXTURE_NOT_AUTHORITY", path: "preview" }]);
        const { createFixturePreviewResolver } = await import("./fixtureResolver");
        return createFixturePreviewResolver({ runtimeTools: Object.fromEntries(TOOL_REGISTRY_DEFINITIONS.map(t => [t.id, t.name])) }).resolveForTeacherPreview(request);
      }
      try {
        if (!await dependencies.canPreviewBundle(scope, request.bundleId)) return unavailable([{ code: "PREVIEW_SCOPE_UNAVAILABLE", path: "preview" }]);
        const fractions = request.bundleId === "g4-math-fractions" ? grade4FractionsReadiness() : null;
        const authorityMetadata: PreviewAuthorityMetadata = { readiness: fractions?.status ?? "BLOCKED", objectiveDescriptions: {}, offlinePackageClosed: false };
        // There is no reviewed immutable composition version selector. Never choose latest.
        if (request.bundleVersion === null) return unavailable([{ code: "VERSION_SELECTION_REQUIRED", path: "input.bundleVersion" }, ...(fractions?.diagnostics ?? [])], authorityMetadata);
        const reader = dependencies.createReader(scope);
        let release: CurriculumOntologyRelease | null = null;
        let inventory: GovernedCellInventory | null = null;
        let mapping: ToolkitMapping | null = null;
        const nativeDescriptions: Record<string, string> = {};
        // Capture the SAME authorized reads. Display metadata makes no extra sensitive queries.
        const resolved = await resolveContentBundle({ bundleId: request.bundleId, bundleVersion: request.bundleVersion }, {
          ...reader,
          readRelease: async id => { release = await reader.readRelease(id); return release; },
          readInventory: async r => { inventory = await reader.readInventory(r); return inventory; },
          readToolkitMapping: async ref => { mapping = await reader.readToolkitMapping(ref); return mapping; },
          readRevision: async pin => {
            const revision = await reader.readRevision(pin);
            for (const objective of revision?.nativeLesson?.objectives ?? []) if (objective.statement) nativeDescriptions[objective.id] = objective.statement;
            return revision;
          },
        });
        if (resolved.status !== "RESOLVED") return { ...resolved, diagnostics: [...resolved.diagnostics, ...(fractions?.diagnostics ?? [])], authorityMetadata };
        const synthetic = resolved.bundle.curriculumAuthority.releaseId.startsWith("fixture.") || resolved.bundle.identity.version.includes("fixture") || dependencies.source?.kind === "FIXTURE";
        if (synthetic && env.NODE_ENV === "production") return unavailable([{ code: "FIXTURE_NOT_AUTHORITY", path: "preview" }]);
        const source = synthetic ? { kind: "FIXTURE" as const, label: "Synthetic resolver fixture (not curriculum, not reviewed, not released)", authoritative: false } : dependencies.source ?? { kind: "GOVERNED_STORE" as const, label: "Exact governed authority resolution", authoritative: true };
        return {
          ...resolved, contentHash: resolved.bundle.identity.contentHash!, source,
          authorityMetadata: { ...authorityMetadata, readiness: source.authoritative ? "READY" : "BLOCKED", objectiveDescriptions: { ...objectiveDescriptions(release, inventory), ...nativeDescriptions } },
          release: source.authoritative ? { state: "RELEASED", releaseRef: resolved.bundle.curriculumAuthority.releaseId, reason: "Resolved against an approved published ontology. Preview does not publish or assign this bundle." } : { state: "NOT_EVALUATED", reason: "Synthetic authority readers for testing only; not a curriculum release." },
          labReadiness: {}, // Wave 2B rejects every current lab revision/certification binding.
          toolkit: { mapping: mapping ? { ...mapping, reviewed: source.authoritative } : null, runtimeToolNames: Object.fromEntries(TOOL_REGISTRY_DEFINITIONS.map(t => [t.id, t.name])), issues: [] },
        };
      } catch {
        return unavailable([{ code: "AUTHORITY_READ_FAILED", path: "authority" }]);
      }
    },
  };
}
