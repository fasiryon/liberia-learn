import { beforeEach, describe, expect, it, vi } from "vitest";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { deterministicReleaseIdentity, GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { resolveLessonDelivery, deliveryTrustDisposition } from "@/lib/lessons/lessonExperienceDelivery";

// Reviewed native releases exist only in these isolated mocks, never in production data.
const authority = vi.hoisted(() => ({ release: null as any, inventory: null as any }));
vi.mock("@/lib/learning-authority/publishedReleases", () => ({ publishedRelease: () => authority.release }));
vi.mock("@/lib/learning-authority/governedInventoryRuntime", () => ({ governedInventoryForRelease: () => authority.inventory }));

const objectiveId = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";
let row: any;
let tx: any;
let event: any;
const learner = { id: "learner", role: "STUDENT", schoolId: "school-a" };
function pin() {
  row.payload.curriculumV2.authoring.releaseIdentity = deterministicReleaseIdentity(authority.release);
  const final = buildCurriculumContentSnapshot(row);
  row.provenance.currentRevision.contentHash = hashCurriculumSnapshot(final.schemaVersion, final.snapshot);
}
beforeEach(() => {
  const result = runG4Proof("equivalent-fractions.json", objectiveId);
  if (result.status === "REJECTED") throw new Error(result.errors.join());
  const lesson = structuredClone(result.lesson);
  row = { id: "row", contentId: lesson.identity.lessonId, version: lesson.identity.version, grade: 4, subject: "MATH", contentType: "lesson", schoolId: "school-a", teacherCreated: false, visibility: "class_only", status: "published", payload: { curriculumV2: lesson }, provenance: { id: "provenance", lifecycleState: "APPROVED", currentRevisionId: "revision", currentRevision: { id: "revision", sequence: 1, snapshotSchemaVersion: 2, contentHash: "" } } };
  event = { id: "approval", revisionId: "revision", lifecycleResult: "APPROVED", eventType: "APPROVED", approvalBasis: "HUMAN_REVIEW", actorType: "USER", actorUserId: "reviewer", reviewAuthority: "PLATFORM", reviewerQualificationRef: "qualification", reviewerQualificationSnapshot: {} };
  authority.release = structuredClone(GRADE4_MATH_ONTOLOGY_RELEASE);
  authority.release.id = lesson.authoring.releaseId;
  authority.release.contentBindings = [{ id: "binding", conceptId: lesson.objectives[0].conceptIds[0], contentId: row.contentId, contentVersion: row.version, contentType: "LESSON", toolPolicyId: "tools" }];
  authority.inventory = { lessons: [{ contentId: row.contentId, version: row.version, objectiveIds: [objectiveId], conceptIds: lesson.objectives[0].conceptIds }], concepts: lesson.objectives[0].conceptIds.map((conceptId) => ({ conceptId, objectiveId })), activities: [] };
  authority.release.items = lesson.assessmentHandoffs.flatMap((ref) => ref.governedItems.map((item) => ({ id: item.itemId, version: item.itemVersion, context: "PRACTICE", prompt: item.prompt, options: item.options, correctIndex: 0 })));
  authority.inventory.activities = authority.release.items.map((item: any) => ({ activityId: item.id, activityVersion: item.version, objectiveId }));
  pin();
  tx = { curriculumContent: { findUnique: vi.fn(async () => row) }, scheduledWork: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => ({ id: "work" })) }, teacherLessonAssignment: { findFirst: vi.fn(async () => null) }, student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "class", Class: { schoolId: "school-a" } }] })) }, curriculumGovernanceEvent: { findFirst: vi.fn(async () => event) }, curriculumContentRevision: { findFirst: vi.fn(async () => row.provenance.currentRevision) } };
});

describe("server lesson delivery authority", () => {
  it("A/H/I: serves approved exact-revision native scenes with no private keys or mastery authority", async () => {
    const result = await resolveLessonDelivery(tx, learner, row.contentId);
    expect(result.compatibility).toBe("NATIVE_V2");
    expect(result.sceneIds.length).toBeGreaterThan(1);
    expect(result.objectiveIds).toEqual([objectiveId]);
    expect(result.provenance).toMatchObject({ revisionId: "revision", approvalId: "approval" });
    expect(result.evidenceDisposition).toMatchObject({ status: "OBSERVATION_ONLY", authoritativeSubmission: false, masteryMutation: false });
    expect(JSON.stringify(result)).not.toMatch(/correctIndex|formativeKey|answerKey|teacherNotes|reviewerQualification|promptHash|optionFeedback/);
  });
  it.each(["DRAFT", "PENDING_REVIEW", "REVOKED"])("B: denies lifecycle %s", async (state) => {
    row.provenance.lifecycleState = state;
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("C: denies foreign schools", async () => {
    await expect(resolveLessonDelivery(tx, { ...learner, schoolId: "school-b" }, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it.each(["TEACHER", "ADMIN"])("D: denies role %s", async (role) => {
    await expect(resolveLessonDelivery(tx, { ...learner, role }, row.contentId)).rejects.toMatchObject({ status: 403 });
  });
  it("E: rejects a requested old version", async () => {
    await expect(resolveLessonDelivery(tx, learner, row.contentId, "old")).rejects.toMatchObject({ status: 409 });
  });
  it("rejects absent release binding", async () => {
    authority.release.contentBindings = [];
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("rejects release identity mismatch and unresolved curriculum objectives", async () => {
    row.payload.curriculumV2.authoring.releaseIdentity = "untrusted";
    const snapshot = buildCurriculumContentSnapshot(row);
    row.provenance.currentRevision.contentHash = hashCurriculumSnapshot(snapshot.schemaVersion, snapshot.snapshot);
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
    pin();
    authority.inventory.lessons[0].objectiveIds = [];
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("H: rebuilds assessment prompts/options from release authority, never stored keys", async () => {
    authority.release.items[0].prompt = "Reviewed prompt";
    authority.release.items[0].options = ["Reviewed option"];
    pin();
    const result = await resolveLessonDelivery(tx, learner, row.contentId);
    expect(result.assessmentRefs[0].items[0]).toMatchObject({ prompt: "Reviewed prompt", options: ["Reviewed option"] });
    expect(JSON.stringify(result.assessmentRefs)).not.toMatch(/correctIndex|hint|workedExample|answerKey/);
    authority.inventory.activities = [];
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("rejects an altered payload after review", async () => {
    row.payload.curriculumV2.scenes[0].title = "Changed after approval";
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("rejects an approval for another revision or an automated approval", async () => {
    event.revisionId = "older";
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
    event.revisionId = "revision";
    event.approvalBasis = "AUTOMATED_RISK_POLICY";
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("rejects missing enrollment/assignment", async () => {
    tx.scheduledWork.findFirst.mockResolvedValue(null);
    await expect(resolveLessonDelivery(tx, learner, row.contentId)).rejects.toMatchObject({ status: 404 });
  });
  it("G: does not attach showcase labs by subject or grade", async () => {
    const result = await resolveLessonDelivery(tx, learner, row.contentId);
    expect(result.authorizedLabLinks).toEqual([]);
  });
  it("J: adapts legacy content without inventing native scenes or objective identities", async () => {
    row.payload = { title: "Legacy", body: "Safe instruction", answerKey: "secret" };
    row.provenance = null;
    const result = await resolveLessonDelivery(tx, learner, row.contentId);
    expect(result.compatibility).toBe("LEGACY_COMPATIBLE");
    expect(result.legacyPayload?.body).toContain("Safe instruction");
    expect(result.scenes).toEqual([]);
    expect(result.objectiveIds).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("preserves enrolled scheduled-work aliases and denies foreign-class aliases", async () => {
    tx.curriculumContent.findUnique.mockResolvedValue(null);
    tx.scheduledWork.findUnique.mockResolvedValue({ content: row, classId: "class", class: { schoolId: "school-a" } });
    expect((await resolveLessonDelivery(tx, learner, "work")).lessonId).toBe(row.contentId);
    tx.scheduledWork.findUnique.mockResolvedValue({ content: row, classId: "foreign", class: { schoolId: "school-b" } });
    await expect(resolveLessonDelivery(tx, learner, "work")).rejects.toMatchObject({ status: 404 });
  });
  it("K: stale/offline/revoked identity never grants submission", () => {
    const current = { lessonId: "lesson", lessonVersion: "1", releaseId: "release", releaseIdentity: "hash", revisionId: "revision" };
    expect(deliveryTrustDisposition(current, current, false)).toBe("OFFLINE_PENDING");
    expect(deliveryTrustDisposition(current, { ...current, lessonVersion: "2" }, true)).toBe("INCOMPATIBLE_VERSION");
    expect(deliveryTrustDisposition(current, { ...current, releaseIdentity: "new" }, true)).toBe("INCOMPATIBLE_VERSION");
    expect(deliveryTrustDisposition(current, null, true)).toBe("READ_ONLY");
  });
});
