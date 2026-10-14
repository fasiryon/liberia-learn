import { describe, expect, it, vi } from "vitest";
import { ACTIVITY_KINDS } from "@/lib/content-bundle/v1/types";
import { createSyntheticResolverAuthority } from "@/lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import { resolveContentBundle } from "@/lib/content-bundle/v1/resolver";
import { hashContentBundle } from "@/lib/content-bundle/v1/hash";
import { deterministicReleaseIdentity, type CurriculumContentBinding, type CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { hashActivityDefinition } from "@/lib/activity-definition/v1/hash";
import { parseActivityDefinition } from "@/lib/activity-definition/v1/validator";
import { resolveActivityDefinition, type ActivityAuthorityReader } from "@/lib/activity-definition/v1/resolver";
import { activityBundleMember, type ActivityDefinitionV1 } from "@/lib/activity-definition/v1/types";

vi.mock("@/lib/db", () => { throw new Error("Activity resolver must not load database access"); });
type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };

function fixture() {
  const raw = createSyntheticResolverAuthority();
  const base = { ...raw, release: raw.release as Mutable<CurriculumOntologyRelease> };
  const { identity, extensions: _extensions, ...content } = base.bundle.activities[0];
  const definition = {
    schemaVersion: "activity-definition.v1", activityId: identity.itemId, version: identity.itemVersion, kind: identity.itemKind,
    contentHash: "0".repeat(64), content, resources: base.bundle.resources,
    lessonBindings: content.lessonItemIds.map(lessonId => ({ lessonId, version: base.bundle.lessons.find(l => l.identity.itemId === lessonId)!.identity.itemVersion })),
    release: { releaseId: base.release.id, releaseIdentity: "pending" }, governance: base.bundle.governance,
  } as Mutable<ActivityDefinitionV1>;
  const authority: ActivityAuthorityReader = {
    readActivity: vi.fn(async () => ({ definition, revision: base.pins[definition.activityId] })),
    readRevision: base.reader.readRevision, readRelease: base.reader.readRelease, readInventory: base.reader.readInventory,
    readCurriculumAuthority: base.reader.readCurriculumAuthority, readResource: base.reader.readResource,
    readRubric: vi.fn(async ref => ref),
  };
  function refresh() {
    definition.contentHash = hashActivityDefinition(definition);
    const bindings: CurriculumContentBinding[] = base.release.contentBindings.filter(b => b.contentType !== "ACTIVITY");
    for (const concept of base.inventory.concepts.filter(c => definition.content.objectiveIds.includes(c.objectiveId))) bindings.push({ ...base.release.contentBindings[0], id: `synthetic.activity.${concept.conceptId}.${concept.objectiveId}`, conceptId: concept.conceptId, contentId: definition.activityId, contentVersion: definition.version, contentType: "ACTIVITY", contentSha256: definition.contentHash });
    base.release.contentBindings = bindings as typeof base.release.contentBindings;
    const releaseIdentity = deterministicReleaseIdentity(base.release);
    base.inventory.releaseIdentity = releaseIdentity;
    base.bundle.curriculumAuthority.releaseIdentity = releaseIdentity;
    definition.release.releaseIdentity = releaseIdentity;
    const member = activityBundleMember(definition);
    const snapshot = { activityDefinition: structuredClone(definition) };
    const revision = { ...base.revisions[definition.activityId], member, snapshot, contentHash: hashCurriculumSnapshot(1, snapshot) };
    base.revisions[definition.activityId] = revision;
    base.pins[definition.activityId] = { revisionId: revision.revisionId, provenanceId: revision.provenanceId, contentHash: revision.contentHash };
  }
  refresh();
  const input = () => ({ activityId: definition.activityId, version: definition.version, authorityContext: { reader: authority, releaseId: base.release.id, releaseIdentity: definition.release.releaseIdentity } });
  const resolve = () => resolveActivityDefinition(input());
  function pointers() {
    base.bundle.activities = base.bundle.activities.filter(a => a.identity.itemId !== definition.activityId);
    base.bundle.activityReferences = [{ activityId: definition.activityId, version: definition.version, kind: definition.kind }];
    base.reader.activityAuthority = authority;
  }
  return { ...base, definition, authority, refresh, input, resolve, pointers };
}

describe("Governed ActivityDefinition V1 (synthetic authority only)", () => {
  it.each(ACTIVITY_KINDS)("resolves exact reviewed, released %s content", async kind => {
    const f = fixture(); f.definition.kind = kind; f.refresh();
    expect((await f.resolve()).status).toBe("RESOLVED");
  });
  it.each(["", "latest", "current", "*", undefined])("requires exact version %s before reads", async version => {
    const f = fixture();
    expect((await resolveActivityDefinition({ ...f.input(), version: version as string })).status).toBe("INCOMPATIBLE");
    expect(f.authority.readActivity).not.toHaveBeenCalled();
  });
  it("rejects a different stored version", async () => {
    const f = fixture(); expect((await resolveActivityDefinition({ ...f.input(), version: "999" })).status).toBe("INCOMPATIBLE");
  });
  it("returns unavailable without content when storage is missing or throws", async () => {
    const f = fixture(); f.authority.readActivity = async () => null;
    expect(await f.resolve()).toMatchObject({ status: "UNAVAILABLE", definition: null });
    f.authority.readActivity = async () => { throw new Error("private storage error"); };
    expect(await f.resolve()).toMatchObject({ status: "UNAVAILABLE", definition: null, diagnostics: [{ code: "AUTHORITY_READ_FAILED" }] });
  });
  it("rejects stale semantic and snapshot hashes", async () => {
    const f = fixture(); f.definition.content.instructions.learner[0].text += "changed";
    expect((await f.resolve()).diagnostics[0].code).toBe("ACTIVITY_HASH_STALE");
    f.refresh(); f.revisions[f.definition.activityId] = { ...f.revisions[f.definition.activityId], snapshot: {} };
    expect((await f.resolve()).diagnostics[0].code).toBe("REVISION_HASH_MISMATCH");
  });
  it("rejects empty and unknown objectives", async () => {
    const f = fixture(); f.definition.content.objectiveIds = []; f.refresh();
    expect((await f.resolve()).status).toBe("INCOMPATIBLE");
    f.definition.content.objectiveIds = ["missing.objective"]; f.refresh();
    expect((await f.resolve()).diagnostics[0].code).toBe("OBJECTIVE_MISSING");
  });
  it.each(["DRAFT", "PENDING_REVIEW", "REJECTED", "REVOKED", "SUPERSEDED"])("rejects %s lifecycle for release", async lifecycleState => {
    const f = fixture(); f.revisions[f.definition.activityId] = { ...f.revisions[f.definition.activityId], lifecycleState };
    expect((await f.resolve()).status).toBe("INCOMPATIBLE");
  });
  it("allows explicit draft inspection without implying release eligibility", async () => {
    const f = fixture(); f.revisions[f.definition.activityId] = { ...f.revisions[f.definition.activityId], lifecycleState: "DRAFT" };
    expect((await resolveActivityDefinition({ ...f.input(), authorityContext: { ...f.input().authorityContext, requireReleased: false } })).status).toBe("RESOLVED");
    expect((await f.resolve()).status).toBe("INCOMPATIBLE");
  });
  it("requires published approved release and exact binding hash", async () => {
    const f = fixture(); f.release.contentBindings = f.release.contentBindings.filter(b => b.contentType !== "ACTIVITY");
    f.inventory.releaseIdentity = deterministicReleaseIdentity(f.release); f.bundle.curriculumAuthority.releaseIdentity = f.inventory.releaseIdentity;
    f.definition.release.releaseIdentity = f.inventory.releaseIdentity;
    // Preserve the modified release without rebuilding its activity binding.
    const snapshot = { activityDefinition: structuredClone(f.definition) };
    const r = f.revisions[f.definition.activityId];
    f.revisions[f.definition.activityId] = { ...r, snapshot, contentHash: hashCurriculumSnapshot(1, snapshot) };
    f.pins[f.definition.activityId].contentHash = f.revisions[f.definition.activityId].contentHash;
    expect((await f.resolve()).diagnostics[0].code).toBe("ACTIVITY_NOT_RELEASED");
    const g = fixture(); g.release.status = "DRAFT";
    expect((await g.resolve()).diagnostics[0].code).toBe("RELEASE_NOT_APPROVED_PUBLISHED");
  });
  it("rejects release and provenance mismatch", async () => {
    const f = fixture();
    expect((await resolveActivityDefinition({ ...f.input(), authorityContext: { ...f.input().authorityContext, releaseIdentity: "wrong" } })).status).toBe("INCOMPATIBLE");
    f.revisions[f.definition.activityId] = { ...f.revisions[f.definition.activityId], provenanceCompleteness: "UNKNOWN" };
    expect((await f.resolve()).diagnostics[0].code).toBe("PROVENANCE_UNVERIFIED");
  });
  it("checks exact resources, learner audience and rubric integrity", async () => {
    const f = fixture(); f.authority.readResource = async () => null;
    expect((await f.resolve()).diagnostics[0].code).toBe("RESOURCE_VERSION_UNRESOLVED");
    const g = fixture(); g.definition.content.instructions.learner[0].resourceIds = ["missing"]; g.refresh();
    expect((await g.resolve()).diagnostics[0].code).toBe("RESOURCE_REFERENCE_INVALID");
    const h = fixture(); h.definition.content.rubric = { rubricId: "rubric", rubricVersion: "1", learnerVisibleCriteria: [], scoringGuideResourceId: null }; h.refresh();
    h.authority.readRubric = async () => null;
    expect((await h.resolve()).diagnostics[0].code).toBe("RUBRIC_VERSION_UNRESOLVED");
    h.definition.content.rubric.scoringGuideResourceId = h.definition.resources.find(r => r.audience === "LEARNER")!.resourceId; h.refresh();
    h.authority.readRubric = async ref => ref;
    expect((await h.resolve()).diagnostics[0].code).toBe("RUBRIC_RESOURCE_INVALID");
  });
  it.each(["studentId", "submission", "grades", "completion", "mastery", "nextLesson", "approved", "approval", "extensions"])("has no %s field", key => {
    expect(parseActivityDefinition({ ...fixture().definition, [key]: true })).toBeNull();
  });
  it("rejects unsupported kind and nested state", () => {
    const f = fixture();
    expect(parseActivityDefinition({ ...f.definition, kind: "EXAM" })).toBeNull();
    expect(parseActivityDefinition({ ...f.definition, content: { ...f.definition.content, studentId: "student" } })).toBeNull();
  });
  it("hash is deterministic, set-order independent and excludes review history", () => {
    const f = fixture(); const before = hashActivityDefinition(f.definition);
    f.definition.resources.reverse(); f.definition.content.objectiveIds.reverse();
    f.definition.governance = { ...f.definition.governance, reviewRefs: ["new-review"], lifecycleRefs: ["event"], releaseRefs: ["release-event"] };
    expect(hashActivityDefinition(f.definition)).toBe(before);
    expect(hashActivityDefinition(structuredClone(f.definition))).toBe(before);
  });
  it.each(["instructions", "objectives", "resources", "rubric", "collaboration", "evidence", "duration", "accessibility", "lessonVersion"])("hash binds %s", field => {
    const f = fixture(); const before = hashActivityDefinition(f.definition);
    if (field === "instructions") f.definition.content.instructions.teacher.push({ stepId: "extra", text: "Prompt", resourceIds: [] });
    if (field === "objectives") f.definition.content.objectiveIds.push("objective");
    if (field === "resources") f.definition.resources[0].resourceVersion += ".new";
    if (field === "rubric") f.definition.content.rubric = { rubricId: "r", rubricVersion: "2", learnerVisibleCriteria: [], scoringGuideResourceId: null };
    if (field === "collaboration") f.definition.content.collaborationMode = f.definition.content.collaborationMode === "PAIR" ? "INDIVIDUAL" : "PAIR";
    if (field === "evidence") f.definition.content.evidenceIntent.kind = "SUMMATIVE_CANDIDATE";
    if (field === "duration") f.definition.content.expectedDurationMinutes++;
    if (field === "accessibility") f.definition.content.accessibility.supportsReadAloud = !f.definition.content.accessibility.supportsReadAloud;
    if (field === "lessonVersion") f.definition.lessonBindings[0].version += ".new";
    expect(hashActivityDefinition(f.definition)).not.toBe(before);
  });
  it("resolves bundle pointers without embedding payload in composition or changing its hash", async () => {
    const f = fixture(); f.pointers();
    const before = hashContentBundle(f.bundle);
    const result = await resolveContentBundle({ bundleId: f.bundle.identity.bundleId, bundleVersion: f.bundle.identity.version }, f.reader);
    expect(result.status).toBe("RESOLVED");
    expect(result.bundle!.activities.some(a => a.identity.itemId === f.definition.activityId)).toBe(true);
    expect(hashContentBundle(result.bundle!)).toBe(before);
    expect(f.bundle.activities.some(a => a.identity.itemId === f.definition.activityId)).toBe(false);
  });
  it("bundle rejects wrong exact version, missing authority, revision pin and duplicated payload", async () => {
    for (const fault of ["version", "authority", "pin", "duplicate"]) {
      const f = fixture(); f.pointers();
      if (fault === "version") f.bundle.activityReferences![0].version = "999";
      if (fault === "authority") f.reader.activityAuthority = undefined;
      if (fault === "pin") delete f.pins[f.definition.activityId];
      if (fault === "duplicate") f.bundle.activities.push(activityBundleMember(f.definition) as Mutable<ReturnType<typeof activityBundleMember>>);
      const result = await resolveContentBundle({ bundleId: f.bundle.identity.bundleId, bundleVersion: f.bundle.identity.version }, f.reader);
      expect(result.status).not.toBe("RESOLVED"); expect(result.bundle).toBeNull();
    }
  });
  it("performs only reads and leaves supplied records unchanged", async () => {
    const f = fixture(); const before = JSON.stringify({ definition: f.definition, revisions: f.revisions, pins: f.pins });
    expect((await f.resolve()).status).toBe("RESOLVED");
    expect(JSON.stringify({ definition: f.definition, revisions: f.revisions, pins: f.pins })).toBe(before);
    expect(Object.keys(f.authority).every(key => key.startsWith("read"))).toBe(true);
  });
});
