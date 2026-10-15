import { beforeEach, describe, expect, it, vi } from "vitest";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { deterministicReleaseIdentity, GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";

// The real route and real delivery resolver run against an in-memory transaction; only auth,
// the database handle and reviewed release lookups are substituted.
const ports = vi.hoisted(() => ({ auth: vi.fn(), tx: null as any, release: null as any, inventory: null as any }));
vi.mock("@/lib/auth", () => ({ requireRole: ports.auth }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback(ports.tx) } }));
vi.mock("@/lib/learning-authority/publishedReleases", () => ({ publishedRelease: () => ports.release }));
vi.mock("@/lib/learning-authority/governedInventoryRuntime", () => ({ governedInventoryForRelease: () => ports.inventory }));
import { GET } from "@/app/api/student/lessons/[id]/experience/route";
import { loadLessonDelivery } from "@/lib/learner-experience/lessonRuntimeClient";

const objectiveId = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";
const PINS = { bundleId: "national.g4.fractions", bundleVersion: "1.0.0", bundleContentHash: "a".repeat(64), itemId: "lesson", itemVersion: "1.0.0", itemKind: "LESSON" };
let content: any;
let work: any;

beforeEach(() => {
  ports.auth.mockResolvedValue({ id: "learner", role: "STUDENT", schoolId: "school-a" });
  const result = runG4Proof("equivalent-fractions.json", objectiveId);
  if (result.status === "REJECTED") throw new Error(result.errors.join());
  const lesson = structuredClone(result.lesson);
  content = { id: "row", contentId: lesson.identity.lessonId, version: lesson.identity.version, grade: 4, subject: "MATH", contentType: "lesson", schoolId: "school-a", teacherCreated: false, visibility: "class_only", status: "published", payload: { curriculumV2: lesson }, provenance: { id: "provenance", lifecycleState: "APPROVED", currentRevisionId: "revision", currentRevision: { id: "revision", sequence: 1, snapshotSchemaVersion: 2, contentHash: "" } } };
  const event = { id: "approval", revisionId: "revision", lifecycleResult: "APPROVED", eventType: "APPROVED", approvalBasis: "HUMAN_REVIEW", actorType: "USER", actorUserId: "reviewer", reviewAuthority: "PLATFORM", reviewerQualificationRef: "qualification", reviewerQualificationSnapshot: {} };
  ports.release = structuredClone(GRADE4_MATH_ONTOLOGY_RELEASE);
  ports.release.id = lesson.authoring.releaseId;
  ports.release.contentBindings = [{ id: "binding", conceptId: lesson.objectives[0].conceptIds[0], contentId: content.contentId, contentVersion: content.version, contentType: "LESSON", toolPolicyId: "tools" }];
  ports.inventory = { lessons: [{ contentId: content.contentId, version: content.version, objectiveIds: [objectiveId], conceptIds: lesson.objectives[0].conceptIds }], concepts: lesson.objectives[0].conceptIds.map((conceptId: string) => ({ conceptId, objectiveId })), activities: [] };
  ports.release.items = lesson.assessmentHandoffs.flatMap((ref: any) => ref.governedItems.map((item: any) => ({ id: item.itemId, version: item.itemVersion, context: "PRACTICE", prompt: item.prompt, options: item.options, correctIndex: 0 })));
  ports.inventory.activities = ports.release.items.map((item: any) => ({ activityId: item.id, activityVersion: item.version, objectiveId }));
  content.payload.curriculumV2.authoring.releaseIdentity = deterministicReleaseIdentity(ports.release);
  const snapshot = buildCurriculumContentSnapshot(content);
  content.provenance.currentRevision.contentHash = hashCurriculumSnapshot(snapshot.schemaVersion, snapshot.snapshot);
  work = { id: "work", classId: "class", class: { schoolId: "school-a" }, bundleId: null, bundleVersion: null, bundleContentHash: null, itemId: null, itemVersion: null, itemKind: null };
  ports.tx = {
    curriculumContent: { findUnique: vi.fn(async () => null) },
    // First call selects scope + pins only; a second (content) call must happen only for legacy rows.
    scheduledWork: {
      findFirst: vi.fn(async () => ({ id: "work" })),
      findUnique: vi.fn(async (args: { select?: unknown; include?: unknown }) => args.include ? { ...work, content, progress: [] } : { ...work }),
    },
    teacherLessonAssignment: { findFirst: vi.fn(async () => null) },
    student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "class", Class: { schoolId: "school-a" } }] })) },
    curriculumGovernanceEvent: { findFirst: vi.fn(async () => event) },
    curriculumContentRevision: { findFirst: vi.fn(async () => content.provenance.currentRevision) },
  };
});

const request = (kind?: string) => GET(new Request(`https://example.test/api/student/lessons/work/experience${kind ? `?kind=${kind}` : ""}`), { params: { id: "work" } });
const contentLoaded = () => ports.tx.scheduledWork.findUnique.mock.calls.some(([args]: [{ include?: unknown }]) => !!args.include);

describe("student experience API classifies ScheduledWork pins before legacy delivery", () => {
  it.each(["SCHEDULED_WORK", undefined])("LEGACY_UNPINNED keeps existing delivery (kind=%s)", async kind => {
    const response = await request(kind);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ compatibility: "NATIVE_V2", lessonId: content.contentId, routeTarget: { kind: "SCHEDULED_WORK", scheduledWorkId: "work" } });
  });
  it.each(["SCHEDULED_WORK", undefined])("GOVERNED_PINNED never enters mutable legacy delivery (kind=%s)", async kind => {
    Object.assign(work, PINS);
    const response = await request(kind);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ compatibility: "UNAVAILABLE", error: "GOVERNED_WORK_UNAVAILABLE" });
    expect(contentLoaded()).toBe(false);
    expect(JSON.stringify(body)).not.toContain(content.contentId);
  });
  it.each([{ bundleId: "b" }, { ...PINS, itemKind: null }, { ...PINS, bundleContentHash: "short" }, { ...PINS, itemVersion: " latest " }])("INVALID_PARTIAL_PIN fails closed %j", async pins => {
    Object.assign(work, pins);
    const response = await request("SCHEDULED_WORK");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ compatibility: "UNAVAILABLE", error: "INVALID_GOVERNED_PIN" });
    expect(contentLoaded()).toBe(false);
  });
  it("a foreign learner learns nothing about a pinned row's classification", async () => {
    Object.assign(work, PINS, { class: { schoolId: "school-b" } });
    const response = await request("SCHEDULED_WORK");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ compatibility: "UNAVAILABLE", error: "UNAVAILABLE" });
    expect(contentLoaded()).toBe(false);
  });
  it("the learner runtime treats governed refusal as terminal unavailability, not a legacy fallback", async () => {
    Object.assign(work, PINS);
    const response = await request("SCHEDULED_WORK");
    vi.stubGlobal("fetch", vi.fn(async () => response));
    try {
      expect(await loadLessonDelivery({ kind: "SCHEDULED_WORK", scheduledWorkId: "work" })).toMatchObject({ kind: "UNAVAILABLE" });
    } finally { vi.unstubAllGlobals(); }
  });
});
