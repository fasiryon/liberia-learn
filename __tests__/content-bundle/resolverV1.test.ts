import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { resolveContentBundle, createTeacherPreviewResolver, isLearnerProjectionSafe, type ContentBundleAuthorityReader, type ResolvedRevision } from "@/lib/content-bundle/v1/resolver";
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING } from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { governedInventoryForRelease } from "@/lib/learning-authority/governedInventoryRuntime";
import { isCanonicalToolId } from "@/lib/curriculum/v2/tools";
import { hashContentBundle } from "@/lib/content-bundle/v1/hash";
import type { ContentBundleV1 } from "@/lib/content-bundle/v1/types";
import { grade4FractionsReadiness, createRepositoryContentBundleReader } from "@/lib/content-bundle/v1/repositoryAuthority";

vi.mock("@/lib/db", () => { throw new Error("Resolver must never load a database client"); });

// Synthetic readers only. No production identities/approvals are persisted by this fixture.
type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };
function setup() {
  const bundle = structuredClone(buildGrade4FractionsFixture()) as Mutable<ContentBundleV1>;
  bundle.identity = { ...bundle.identity, subject: GRADE4_MATH_ONTOLOGY_RELEASE.subject };
  const payload = { synthetic: true, learnerText: "Equal parts" };
  const assessmentItems = bundle.assessments.flatMap(a => a.items);
  const release = {
    ...structuredClone(GRADE4_MATH_ONTOLOGY_RELEASE),
    id: "fixture.release.synthetic-resolver", provenanceRef: "fixture.provenance.synthetic",
    items: assessmentItems.map(i => ({ ...GRADE4_MATH_ONTOLOGY_RELEASE.items[0], id: i.assessmentItemId, version: i.assessmentItemVersion })),
    bindings: assessmentItems.map((i, index) => ({ ...GRADE4_MATH_ONTOLOGY_RELEASE.bindings[0], id: `fixture.binding.${index}`, itemId: i.assessmentItemId, itemVersion: i.assessmentItemVersion })),
    contentBindings: [{ ...GRADE4_MATH_ONTOLOGY_RELEASE.contentBindings[0], contentId: bundle.lessons[0].identity.itemId, contentVersion: bundle.lessons[0].identity.itemVersion, contentSha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex") }],
  };
  const inventory = {
    ...governedInventoryForRelease(GRADE4_MATH_ONTOLOGY_RELEASE), releaseId: release.id, releaseIdentity: deterministicReleaseIdentity(release),
    lessons: [{ contentId: bundle.lessons[0].identity.itemId, version: bundle.lessons[0].identity.itemVersion, conceptIds: release.concepts.map(c => c.id), objectiveIds: bundle.curriculumAuthority.objectiveIds, toolPolicyId: release.toolPolicies[0].id }],
    concepts: bundle.curriculumAuthority.objectiveIds.map(objectiveId => ({ conceptId: release.concepts[0].id, objectiveId, objectiveBasis: "MOE_OBJECTIVE" as const, prerequisiteConceptIds: [] })),
  };
  bundle.curriculumAuthority = { ...bundle.curriculumAuthority, releaseId: release.id, releaseIdentity: inventory.releaseIdentity, conceptRefs: release.concepts.map(c => c.id), constructBindingRefs: release.bindings.map(b => b.id) };
  const revisions: Record<string, ResolvedRevision> = {};
  for (const member of [...bundle.lessons, ...bundle.activities, ...bundle.assessments]) {
    const snapshot = { payload, member };
    revisions[member.identity.itemId] = { revisionId: `fixture.revision.${member.identity.itemId}`, provenanceId: "fixture.provenance.synthetic", contentHash: hashCurriculumSnapshot(1, snapshot), snapshotSchemaVersion: 1, lifecycleState: "APPROVED", provenanceCompleteness: "VERIFIED", snapshot, member: structuredClone(member), releasePayload: payload };
  }
  const pins = Object.fromEntries(Object.entries(revisions).map(([id, r]) => [id, { revisionId: r.revisionId, provenanceId: r.provenanceId, contentHash: r.contentHash }]));
  const reader: ContentBundleAuthorityReader = {
    readComposition: vi.fn(async () => ({ manifest: bundle, revisions: pins })),
    readRelease: vi.fn(async () => release),
    readInventory: vi.fn(async () => inventory),
    readCurriculumAuthority: vi.fn(async () => bundle.curriculumAuthority),
    readRevision: vi.fn(async pin => Object.values(revisions).find(r => r.revisionId === pin.revisionId) ?? null),
    readAssessment: vi.fn(async ref => { const a = bundle.assessments.find(a => a.definition.definitionId === ref.definitionId); return a ? { definition: a.definition, items: a.items, itemOrder: a.itemOrder, scoring: "SINGLE_CHOICE_SERVER" as const, source: "RELEASE_ITEMS" as const } : null; }),
    readResource: vi.fn(async ref => ref),
    readAsset: vi.fn(async ref => ref),
    readRendering: vi.fn(async ref => ref),
    readToolkitMapping: vi.fn(async () => G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING),
    isRuntimeToolId: isCanonicalToolId,
  };
  const input = { bundleId: bundle.identity.bundleId, bundleVersion: bundle.identity.version };
  return { bundle, release, inventory, reader, revisions, pins, input };
}
async function expectBlocked(s: ReturnType<typeof setup>, code: string) {
  const result = await resolveContentBundle(s.input, s.reader);
  expect(result.status).not.toBe("RESOLVED");
  expect(result.bundle).toBeNull();
  expect(result.learnerProjection).toBeNull();
  expect(result.diagnostics.map(d => d.code)).toContain(code);
}

describe("read-only bundle resolver", () => {
  it("refuses mutable latest before reading authority", async () => {
    const result = await resolveContentBundle({ bundleId: "x", bundleVersion: "latest" }, null!);
    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.bundle).toBeNull();
  });
  it("resolves synthetic bundle deterministically without mutating inputs or using a DB", async () => {
    const s = setup();
    const before = structuredClone({ bundle: s.bundle, release: s.release, revisions: s.revisions });
    const result = await resolveContentBundle(s.input, s.reader);
    expect(result.diagnostics).toEqual([]);
    expect(result.status).toBe("RESOLVED");
    expect(result.bundle?.identity.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await resolveContentBundle(s.input, s.reader)).toEqual(result);
    expect({ bundle: s.bundle, release: s.release, revisions: s.revisions }).toEqual(before);
    expect(Object.keys(s.reader).every(k => k.startsWith("read") || k === "isRuntimeToolId")).toBe(true);
  });
  it("rejects a missing composition", async () => { const s = setup(); s.reader.readComposition = vi.fn(async () => null); await expectBlocked(s, "COMPOSITION_MISSING"); });
  it("rejects a missing release", async () => { const s = setup(); s.reader.readRelease = vi.fn(async () => null); await expectBlocked(s, "RELEASE_MISSING"); });
  it.each(["DRAFT", "IN_REVIEW"] as const)("rejects %s release", async status => { const s = setup(); s.release.status = status; await expectBlocked(s, "RELEASE_NOT_APPROVED_PUBLISHED"); });
  it("rejects unapproved published release", async () => { const s = setup(); s.release.reviewStatus = "PENDING"; await expectBlocked(s, "RELEASE_NOT_APPROVED_PUBLISHED"); });
  it("rejects missing objective", async () => { const s = setup(); s.reader.readInventory = vi.fn(async () => ({ ...s.inventory, concepts: [] })); await expectBlocked(s, "OBJECTIVE_MISSING"); });
  it("rejects exact bundle version mismatch", async () => { const s = setup(); s.input.bundleVersion = "2.0.0"; await expectBlocked(s, "VERSION_MISMATCH"); });
  it("rejects missing item revision", async () => { const s = setup(); s.reader.readRevision = vi.fn(async () => null); await expectBlocked(s, "ITEM_REVISION_MISSING"); });
  it("rejects member version drift", async () => { const s = setup(); s.bundle.lessons[0] = { ...s.bundle.lessons[0], identity: { ...s.bundle.lessons[0].identity, itemVersion: "2.0.0" } }; await expectBlocked(s, "ITEM_VERSION_OR_CONTENT_MISMATCH"); });
  it("never reseals stale declared content", async () => { const s = setup(); s.bundle.identity = { ...s.bundle.identity, contentHash: hashContentBundle(s.bundle), title: "Changed" }; await expectBlocked(s, "content_hash_stale"); });
  it("rejects caller expected hash mismatch", async () => { const s = setup(); const result = await resolveContentBundle({ ...s.input, expectedContentHash: "0".repeat(64) }, s.reader); expect(result.diagnostics.map(d => d.code)).toContain("CONTENT_HASH_MISMATCH"); });
  it("rejects provenance mismatch", async () => { const s = setup(); s.revisions[s.bundle.lessons[0].identity.itemId] = { ...s.revisions[s.bundle.lessons[0].identity.itemId], provenanceId: "other" }; await expectBlocked(s, "PROVENANCE_REVISION_MISMATCH"); });
  it("rejects corrupt immutable revision", async () => { const s = setup(); s.revisions[s.bundle.lessons[0].identity.itemId] = { ...s.revisions[s.bundle.lessons[0].identity.itemId], snapshot: { altered: true } }; await expectBlocked(s, "REVISION_HASH_MISMATCH"); });
  it("requires exact native V2 definition from schema-2 snapshot", async () => { const s = setup(); const id = s.bundle.lessons[0].identity.itemId; const r = s.revisions[id]; const hash = hashCurriculumSnapshot(2, r.snapshot); s.revisions[id] = { ...r, snapshotSchemaVersion: 2, contentHash: hash }; s.pins[id] = { ...s.pins[id], contentHash: hash }; await expectBlocked(s, "NATIVE_LESSON_REVISION_MISMATCH"); });
  it("rejects asset digest drift", async () => { const s = setup(); s.reader.readAsset = async ref => ({ ...ref, sha256: "0".repeat(64) }); await expectBlocked(s, "ASSET_HASH_OR_VERSION_MISMATCH"); });
  it("rejects mutable resource version", async () => { const s = setup(); s.bundle.resources[0].resourceVersion = "latest"; await expectBlocked(s, "VERSION_PIN_MISSING"); });
  it("rejects unresolved derived rendering", async () => { const s = setup(); s.reader.readRendering = async () => null; await expectBlocked(s, "RENDERING_HASH_OR_VERSION_MISMATCH"); });
  it("rejects revoked revision", async () => { const s = setup(); s.revisions[s.bundle.lessons[0].identity.itemId] = { ...s.revisions[s.bundle.lessons[0].identity.itemId], lifecycleState: "REVOKED" }; await expectBlocked(s, "ITEM_NOT_GOVERNED"); });
  it("rejects unresolved toolkit pin", async () => { const s = setup(); s.reader.readToolkitMapping = vi.fn(async () => null); await expectBlocked(s, "TOOLKIT_MAPPING_UNRESOLVED"); });
  it("rejects wrong toolkit mapping version", async () => { const s = setup(); s.reader.readToolkitMapping = vi.fn(async () => ({ ...G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING, mappingVersion: "other" })); await expectBlocked(s, "toolkit_mapping_mismatch"); });
  it("rejects secret-bearing learner configuration", async () => { const s = setup(); s.bundle.toolkitBindings = s.bundle.toolkitBindings.map(b => ({ ...b, configuration: { ...b.configuration, api_key: "secret value" } })); await expectBlocked(s, "LEARNER_PROJECTION_INVALID"); });
  it("rejects assessment identity failure", async () => { const s = setup(); s.reader.readAssessment = vi.fn(async () => null); await expectBlocked(s, "ASSESSMENT_IDENTITY_INVALID"); });
  it("rejects missing released assessment item", async () => { const s = setup(); s.release.items = s.release.items.slice(1); await expectBlocked(s, "ASSESSMENT_ITEM_NOT_RELEASED"); });
  it("rejects missing exact assessment item version pin", async () => { const s = setup(); s.bundle.assessments[0].items[0].assessmentItemVersion = "latest"; await expectBlocked(s, "ASSESSMENT_VERSION_PIN_MISSING"); });
  it.each(["ANSWER_BEARING_LEGACY_STORE", "UNSUPPORTED_SCORING"])("reports %s", async code => {
    const s = setup(); const read = s.reader.readAssessment;
    s.reader.readAssessment = async ref => ({ ...(await read(ref))!, ...(code === "UNSUPPORTED_SCORING" ? { scoring: "UNSUPPORTED" as const } : { source: "ANSWER_BEARING_LEGACY" as const }) });
    await expectBlocked(s, code);
  });
  it("blocks fabricated lab revision/certification", async () => {
    const s = setup();
    s.bundle.labs = [{ identity: { itemId: "fixture.lab", itemVersion: "1", itemKind: "LAB" }, link: { linkId: "fixture.link", linkRevision: "claimed" }, lab: { labId: "fixture.lab", labVersion: "1" }, objectiveIds: s.bundle.curriculumAuthority.objectiveIds, role: "OPTIONAL", placement: { lessonItemId: s.bundle.lessons[0].identity.itemId, sceneId: null }, authorityBasis: "GOVERNED_LINK" }];
    s.bundle.sequence.units = s.bundle.sequence.units.map(u => ({ ...u, entries: [...u.entries, { itemId: "fixture.lab", order: 7, requirement: "OPTIONAL", prerequisiteItemIds: [], unlocksItemIds: [] }] }));
    await expectBlocked(s, "LAB_REVISION_CERTIFICATION_UNRESOLVED");
  });
  it("learner projection strips all privileged content and validates closure", async () => {
    const s = setup(); s.bundle.governance.reviewRefs = ["REVIEWER-SECRET"]; const result = await resolveContentBundle(s.input, s.reader);
    expect(result.status).toBe("RESOLVED");
    const json = JSON.stringify(result.learnerProjection);
    for (const value of ["secured", "correctIndex", "scoringGuideResourceId", "internalConfiguration", "governance", "REVIEWER-SECRET", "teacher-guide", "answer-key", "teacher-note", "Model the first sharing", "enforcement"]) expect(json).not.toContain(value);
    expect(isLearnerProjectionSafe(result.bundle!, result.learnerProjection!)).toBe(true);
    expect(isLearnerProjectionSafe(result.bundle!, { ...result.learnerProjection!, governance: {} } as never)).toBe(false);
    expect(isLearnerProjectionSafe(result.bundle!, { ...result.learnerProjection!, resources: [{ ...s.bundle.resources[3] }] })).toBe(false);
  });
  it("teacher preview authorizes before any read and excludes server configuration", async () => {
    const s = setup(); const denied = createTeacherPreviewResolver(s.reader, async () => { throw new Error("FORBIDDEN"); });
    await expect(denied(s.input)).rejects.toThrow("FORBIDDEN");
    expect(s.reader.readComposition).not.toHaveBeenCalled();
    const preview = await createTeacherPreviewResolver(s.reader, async () => {})(s.input);
    expect(preview.status).toBe("RESOLVED");
    expect(preview.teacherMetadata?.resources.length).toBeGreaterThan(0);
    expect(JSON.stringify(preview)).not.toContain("internalConfiguration");
    expect(JSON.stringify(preview)).not.toContain("governance");
  });
  it("sanitizes read failures", async () => { const s = setup(); s.reader.readRelease = async () => { throw new Error("secret database URL"); }; await expectBlocked(s, "AUTHORITY_READ_FAILED"); });
  it("reports real repository fractions as PARTIAL without minting bundle identity", () => {
    const result = grade4FractionsReadiness();
    expect(result.status).toBe("PARTIAL");
    expect(result.bundle).toBeNull();
    expect(result.available.releaseId).toBe(GRADE4_MATH_ONTOLOGY_RELEASE.id);
    expect(result.available.lessons).toHaveLength(1);
    expect(result.available.items).toHaveLength(3);
    expect(result.diagnostics.map(d => d.code)).toEqual(expect.arrayContaining(["COMPOSITION_MISSING", "LESSON_PAYLOAD_HASH_MISSING", "EXACT_APPROVED_REVISION_UNVERIFIED", "ASSESSMENT_DEFINITION_MISSING", "TOOLKIT_MAPPING_UNRESOLVED", "LAB_REVISION_CERTIFICATION_UNRESOLVED", "OFFLINE_PACKAGE_GAP"]));
    expect(JSON.stringify(result)).not.toContain("correctIndex");
  });
  it("repository reader uses published registry and never promotes candidates", async () => {
    const s = setup(); const reader = createRepositoryContentBundleReader(s.reader);
    expect(await reader.readRelease("lr-moe-g4-math-fractions-2026.2")).toBeNull();
    expect(await reader.readRelease(GRADE4_MATH_ONTOLOGY_RELEASE.id)).toBe(GRADE4_MATH_ONTOLOGY_RELEASE);
    expect(await reader.readToolkitMapping(G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING)).toBeNull();
  });
});
