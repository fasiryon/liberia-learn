// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { createSyntheticResolverAuthority } from "@/lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { teacherDiagnosticGroups, teacherDiagnosticMessages } from "@/lib/content-bundle/preview/diagnostics";
import { deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import type { ToolkitMapping } from "@/lib/content-bundle/v1/toolkitMapping";
import { ContentBundlePreview, ContentBundlePreviewUnavailable } from "@/components/teacher/content-bundle-preview/ContentBundlePreview";

vi.mock("@/lib/db", () => ({ prisma: { contentBundleRecord: { findFirst: vi.fn(async () => null) } } }));

const viewer = { userId: "teacher-a", role: "TEACHER", schoolId: "school-a" };
function setup() {
  const s = createSyntheticResolverAuthority();
  const readComposition = vi.fn(s.reader.readComposition);
  s.reader.readComposition = readComposition;
  const canPreviewBundle = vi.fn(async (scope, id) => scope.schoolId === "school-a" && id === s.input.bundleId);
  const createReader = vi.fn(() => s.reader);
  const service = getContentBundlePreviewResolver({ NODE_ENV: "test" }, { canPreviewBundle, createReader });
  const request = { ...s.input, viewer };
  return { ...s, request, service, readComposition, createReader, canPreviewBundle };
}
let root: Root | null = null;
let host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root!.unmount()); root = null; host?.remove(); });
async function mount(node: React.ReactNode) {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root!.render(node); });
}
const text = () => host.textContent ?? "";
async function success(s = setup()) {
  const r = await s.service.resolveForTeacherPreview(s.request);
  expect(r.status).toBe("RESOLVED");
  if (r.status !== "RESOLVED") throw new Error("synthetic integration failed");
  return r;
}

describe("integrated school-authorized authority preview", () => {
  it.each(["TEACHER", "ADMIN"])("resolves exact synthetic test authority for an authorized %s", async role => {
    const s = setup(); const r = await s.service.resolveForTeacherPreview({ ...s.request, viewer: { ...viewer, role } });
    expect(r.status).toBe("RESOLVED");
    expect(s.createReader).toHaveBeenCalledWith({ schoolId: "school-a", userId: viewer.userId, role });
    expect(s.readComposition).toHaveBeenCalledWith(s.input);
    if (r.status === "RESOLVED") expect(r.learnerProjection.source.contentHash).toBe(r.bundle.identity.contentHash);
    expect(r.status === "RESOLVED" && r.source.authoritative).toBe(false);
  });
  it.each(["STUDENT", "GUARDIAN", "MOE_OFFICIAL"])("blocks unauthorized %s before all authority reads", async role => {
    const s = setup(); const r = await s.service.resolveForTeacherPreview({ ...s.request, viewer: { ...viewer, role } });
    expect(r.diagnostics[0].code).toBe("PREVIEW_FORBIDDEN");
    expect(s.canPreviewBundle).not.toHaveBeenCalled(); expect(s.createReader).not.toHaveBeenCalled(); expect(s.readComposition).not.toHaveBeenCalled();
  });
  it("blocks missing-school and cross-tenant requests before sensitive reads", async () => {
    const s = setup();
    for (const request of [{ ...s.request, schoolId: "school-b" }, { ...s.request, viewer: { ...viewer, schoolId: null } }]) {
      const r = await s.service.resolveForTeacherPreview(request); expect(r.diagnostics[0].code).toBe("PREVIEW_FORBIDDEN");
    }
    expect(s.createReader).not.toHaveBeenCalled(); expect(s.readComposition).not.toHaveBeenCalled();
  });
  it("blocks arbitrary unscoped bundle inspection before constructing readers", async () => {
    const s = setup(); const r = await s.service.resolveForTeacherPreview({ ...s.request, bundleId: "another-school-private-bundle" });
    expect(r.diagnostics[0].code).toBe("PREVIEW_SCOPE_UNAVAILABLE"); expect(s.createReader).not.toHaveBeenCalled();
  });
  it("requires omitted version selection and refuses latest without composition reads", async () => {
    const s = setup(); const omitted = await s.service.resolveForTeacherPreview({ ...s.request, bundleVersion: null });
    expect(omitted.status).toBe("UNAVAILABLE"); expect(omitted.diagnostics[0].code).toBe("VERSION_SELECTION_REQUIRED"); expect(s.createReader).not.toHaveBeenCalled();
    const latest = await s.service.resolveForTeacherPreview({ ...s.request, bundleVersion: "latest" });
    expect(latest.status).toBe("INCOMPATIBLE"); expect(s.readComposition).not.toHaveBeenCalled();
  });
  it("does not resolve another exact version by fallback", async () => {
    const s = setup(); const r = await s.service.resolveForTeacherPreview({ ...s.request, bundleVersion: "9.0.0" });
    expect(r.status).toBe("INCOMPATIBLE"); expect(r.diagnostics.map(d => d.code)).toContain("VERSION_MISMATCH");
  });
  it("renders RESOLVED with derived objective text and offline not-ready pins", async () => {
    const r = await success(); await mount(<ContentBundlePreview models={buildPreviewModels(r)} />);
    expect(text()).toContain("Ontology concept:"); expect(text()).toContain("Not yet ready: the real offline package is not closed");
    expect(text()).toContain(r.bundle.identity.version); expect(text()).toContain(r.contentHash);
  });
  it("renders UNAVAILABLE with teacher-safe messages", async () => {
    const s = setup(); s.reader.readComposition = async () => null; const r = await s.service.resolveForTeacherPreview(s.request);
    expect(r.status).toBe("UNAVAILABLE");
    await mount(<ContentBundlePreviewUnavailable title="Content unavailable for preview" message="This content is not currently available for preview." diagnostics={teacherDiagnosticMessages(r.diagnostics)} />);
    expect(text()).toContain("Production bundle not yet sealed");
  });
  it("renders INCOMPATIBLE without returning a stale bundle or showing raw errors", async () => {
    const s = setup(); s.bundle.identity.contentHash = "0".repeat(64); const r = await s.service.resolveForTeacherPreview(s.request);
    expect(r.status).toBe("INCOMPATIBLE"); expect(r.bundle).toBeNull(); expect(r.learnerProjection).toBeNull();
    await mount(<ContentBundlePreviewUnavailable title="Bundle cannot safely be resolved" message="Content withheld" diagnostics={teacherDiagnosticMessages(r.diagnostics)} />);
    expect(text()).toContain("Bundle cannot safely be resolved"); expect(text()).not.toContain("content_hash_stale");
    expect(teacherDiagnosticMessages([{ code: "PRIVATE_SQL_ERROR", path: "password=secret" }])).toEqual(["An authority dependency could not be safely resolved."]);
  });
  it("Student View uses the supplied learner projection, never teacher fallbacks, even for headers/announcements", async () => {
    const r = await success(); const sentinel = "TEACHER-ONLY-SECRET";
    const teacherBundle = {
      ...r.bundle, identity: { ...r.bundle.identity, title: sentinel },
      governance: { ...r.bundle.governance, reviewRefs: [sentinel] },
      toolkitBindings: r.bundle.toolkitBindings.map(t => ({ ...t, internalConfiguration: { apiKey: sentinel } })),
      lessons: r.bundle.lessons.map(l => ({ ...l, title: sentinel })),
      assessments: r.bundle.assessments.map(a => ({ ...a, secured: { ...a.secured, scoringGuideResourceId: "fixture.resource.scoring-guide-secret" } })),
      resources: [...r.bundle.resources, { ...r.bundle.resources[0], resourceId: "fixture.resource.scoring-guide-secret", kind: "SCORING_GUIDE" as const, audience: "TEACHER" as const, title: sentinel, assetId: null }],
    };
    const learnerProjection = { ...r.learnerProjection, identity: { ...r.learnerProjection.identity, title: "SERVER LEARNER HEADER" } };
    const models = buildPreviewModels({ ...r, bundle: teacherBundle, learnerProjection });
    expect(JSON.stringify(models.student)).not.toContain(sentinel);
    expect(JSON.stringify(models.teacher)).not.toContain("apiKey"); expect(JSON.stringify(models.teacher)).not.toContain("reviewRefs\":[\"TEACHER");
    for (const secret of ["answer-key", "teacher-note", "scoringGuide", "internalConfiguration", "governance", "TEACHER_GUIDE"]) expect(JSON.stringify(models.student)).not.toContain(secret);
    await mount(<ContentBundlePreview models={models} initialMode="student" />);
    expect(text()).toContain("SERVER LEARNER HEADER"); expect(text()).not.toContain(sentinel);
    const lesson = host.querySelector<HTMLButtonElement>("nav button[data-item-id]") ?? [...host.querySelectorAll<HTMLButtonElement>("nav button")][1];
    await act(async () => { lesson.click(); }); expect(text()).not.toContain(sentinel);
  });
  it("shows reviewed runtime mapping only, and blocks unresolved authority mapping", async () => {
    const r = await success(); const models = buildPreviewModels({ ...r, toolkit: { ...r.toolkit, mapping: { ...r.toolkit.mapping!, reviewed: true } } });
    expect(models.teacher.tools[0].runtimeTools.join(",")).toContain("fraction-visualizer");
    expect(buildPreviewModels(r).teacher.tools[0].runtimeTools).toEqual([]);
    const s = setup(); s.reader.readToolkitMapping = async () => null; const failed = await s.service.resolveForTeacherPreview(s.request);
    expect(failed.status).toBe("INCOMPATIBLE"); expect(teacherDiagnosticMessages(failed.diagnostics)).toContain("Toolkit mapping not yet reviewed: mapping unresolved.");
  });
  it("rejects every current lab binding even with a claimed test revision", async () => {
    const s = setup(); s.bundle.labs = [{ identity: { itemId: "fixture.lab", itemVersion: "1", itemKind: "LAB" }, link: { linkId: "fixture.link", linkRevision: "fixture.claimed" }, lab: { labId: "fixture.lab", labVersion: "1" }, objectiveIds: s.bundle.curriculumAuthority.objectiveIds, role: "OPTIONAL", placement: { lessonItemId: s.bundle.lessons[0].identity.itemId, sceneId: null }, authorityBasis: "GOVERNED_LINK" }];
    s.bundle.sequence.units[0].entries.push({ itemId: "fixture.lab", order: 7, requirement: "OPTIONAL", prerequisiteItemIds: [], unlocksItemIds: [] });
    const r = await s.service.resolveForTeacherPreview(s.request); expect(r.status).toBe("INCOMPATIBLE"); expect(r.diagnostics.map(d => d.code)).toContain("LAB_REVISION_CERTIFICATION_UNRESOLVED");
  });
  it("production path reports real fractions PARTIAL rather than an environment stub", async () => {
    const service = getContentBundlePreviewResolver({ NODE_ENV: "production" });
    for (const bundleVersion of [null, "1.0.0"]) {
      const r = await service.resolveForTeacherPreview({ bundleId: "g4-math-fractions", bundleVersion, viewer });
      expect(r.status).toBe("UNAVAILABLE"); expect(r.authorityMetadata?.readiness).toBe("PARTIAL"); expect(r.bundle).toBeNull();
      expect(r.diagnostics.map(d => d.code)).toEqual(expect.arrayContaining([bundleVersion === null ? "VERSION_SELECTION_REQUIRED" : "COMPOSITION_MISSING", "ASSESSMENT_DEFINITION_MISSING", "TOOLKIT_MAPPING_UNRESOLVED", "LAB_REVISION_CERTIFICATION_UNRESOLVED", "OFFLINE_PACKAGE_GAP"]));
    }
  });
  it("rejects fixtures in production including navigation aliases", async () => {
    const s = setup(); const service = getContentBundlePreviewResolver({ NODE_ENV: "production" }, { canPreviewBundle: s.canPreviewBundle, createReader: s.createReader });
    const direct = await service.resolveForTeacherPreview({ ...s.request, bundleId: "fixture.bundle.g4-math-fractions", fixturePreview: true });
    expect(direct.diagnostics[0].code).toBe("FIXTURE_NOT_AUTHORITY"); expect(s.createReader).not.toHaveBeenCalled();
    const alias = await service.resolveForTeacherPreview(s.request); expect(alias.diagnostics[0].code).toBe("FIXTURE_NOT_AUTHORITY"); expect(alias.bundle).toBeNull();
  });
  it("does not write or mutate input authority", async () => {
    const s = setup(); const before = JSON.stringify({ bundle: s.bundle, revisions: s.revisions }); await success(s);
    expect(JSON.stringify({ bundle: s.bundle, revisions: s.revisions })).toBe(before);
    expect(Object.keys(s.reader).every(k => k.startsWith("read") || k === "isRuntimeToolId")).toBe(true);
  });
});

/**
 * Synthetic authority with every "fixture" marker removed from the identifiers the server's
 * synthetic heuristic inspects. Authority must still come only from a declared source.
 */
function unmarkedAuthority() {
  const s = createSyntheticResolverAuthority();
  s.release.id = "synthetic.release.unmarked";
  const identity = deterministicReleaseIdentity(s.release);
  s.inventory.releaseId = s.release.id; s.inventory.releaseIdentity = identity;
  s.bundle.identity.version = "1.0.0";
  s.bundle.curriculumAuthority = { ...s.bundle.curriculumAuthority, releaseId: s.release.id, releaseIdentity: identity };
  return { ...s, input: { ...s.input, bundleVersion: "1.0.0" } };
}
const governed = { kind: "GOVERNED_STORE" as const, label: "Declared governed store (test)", authoritative: true };

describe("authority is declared, never inferred from identifiers", () => {
  it("an undeclared source resolves as non-authoritative outside production: no release, readiness or reviewed mapping", async () => {
    const s = unmarkedAuthority();
    const r = await getContentBundlePreviewResolver({ NODE_ENV: "test" }, { canPreviewBundle: async () => true, createReader: () => s.reader }).resolveForTeacherPreview({ ...s.input, viewer });
    expect(r.status).toBe("RESOLVED");
    if (r.status !== "RESOLVED") return;
    expect(r.source.authoritative).toBe(false);
    expect(r.release.state).toBe("NOT_EVALUATED");
    expect(r.authorityMetadata.readiness).toBe("BLOCKED");
    expect(r.toolkit.mapping?.reviewed).toBe(false);
    expect(buildPreviewModels(r).teacher.tools.every(t => t.runtimeTools.length === 0)).toBe(true);
  });
  it("production withholds an undeclared source even when its identifiers look real", async () => {
    const s = unmarkedAuthority();
    const r = await getContentBundlePreviewResolver({ NODE_ENV: "production" }, { canPreviewBundle: async () => true, createReader: () => s.reader }).resolveForTeacherPreview({ ...s.input, viewer });
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.bundle).toBeNull();
    expect(r.diagnostics.map(d => d.code)).toEqual(["AUTHORITY_UNDECLARED"]);
  });
  it("a declared governed source does not imply a reviewed toolkit mapping", async () => {
    const s = unmarkedAuthority();
    const r = await getContentBundlePreviewResolver({ NODE_ENV: "production" }, { canPreviewBundle: async () => true, createReader: () => s.reader, source: governed }).resolveForTeacherPreview({ ...s.input, viewer });
    expect(r.status === "RESOLVED" && r.source.authoritative).toBe(true);
    expect(r.status === "RESOLVED" && r.toolkit.mapping?.reviewed).toBe(false);
  });
  it("only an explicit review attestation marks the mapping reviewed", async () => {
    const s = unmarkedAuthority();
    const attest = vi.fn((m: ToolkitMapping) => m.mappingVersion === "0.0.0-fixture-unreviewed");
    const r = await getContentBundlePreviewResolver({ NODE_ENV: "production" }, { canPreviewBundle: async () => true, createReader: () => s.reader, source: governed, isReviewedToolkitMapping: attest }).resolveForTeacherPreview({ ...s.input, viewer });
    expect(attest).toHaveBeenCalledTimes(1);
    expect(r.status === "RESOLVED" && r.toolkit.mapping?.reviewed).toBe(true);
  });
});

describe("diagnostics distinguish not available / not built / not approved / not resolvable", () => {
  it("groups the real Grade 4 fractions gaps by reason", async () => {
    const r = await getContentBundlePreviewResolver({ NODE_ENV: "production" }).resolveForTeacherPreview({ bundleId: "g4-math-fractions", bundleVersion: "1.0.0", viewer });
    const groups = teacherDiagnosticGroups(r.diagnostics);
    const of = (category: string) => groups.find(g => g.category === category)?.messages ?? [];
    expect(groups.map(g => g.category)).toEqual(["NOT_BUILT", "NOT_APPROVED"]);
    expect(of("NOT_BUILT")).toEqual(expect.arrayContaining(["Production bundle not yet sealed: no immutable composition is available.", "Offline package not yet closed: not yet ready."]));
    expect(of("NOT_APPROVED")).toEqual(expect.arrayContaining(["Toolkit mapping not yet reviewed: mapping unresolved.", "Lab unavailable: stable link revision and certification are unresolved."]));
  });
  it("classifies access, version and unknown codes, never echoing paths", () => {
    const groups = teacherDiagnosticGroups([{ code: "PREVIEW_FORBIDDEN", path: "x" }, { code: "VERSION_SELECTION_REQUIRED", path: "y" }, { code: "PRIVATE_SQL_ERROR", path: "password=secret" }]);
    expect(groups).toEqual([
      { category: "NOT_AVAILABLE", label: "Not available to you here", messages: ["Your account cannot preview content outside its school context."] },
      { category: "NOT_RESOLVABLE", label: "Cannot be resolved safely", messages: ["An exact bundle version is required; no reviewed default version is available.", "An authority dependency could not be safely resolved."] },
    ]);
    expect(JSON.stringify(groups)).not.toContain("password");
  });
  it("renders each group under its own heading", async () => {
    await mount(<ContentBundlePreviewUnavailable title="Content unavailable for preview" message="Not available." groups={teacherDiagnosticGroups([{ code: "COMPOSITION_MISSING", path: "" }, { code: "TOOLKIT_MAPPING_UNRESOLVED", path: "" }])} />);
    const headings = [...host.querySelectorAll("[data-testid=preview-diagnostics] h2")].map(h => h.textContent);
    expect(headings).toEqual(["Not built yet", "Not reviewed or approved yet"]);
    expect(host.querySelector("[data-category=NOT_APPROVED]")?.textContent).toContain("Toolkit mapping not yet reviewed");
  });
});
