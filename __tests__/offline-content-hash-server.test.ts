import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({
  curriculumContent: { findUnique: vi.fn() },
  studentProgress: { upsert: vi.fn(), findUnique: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  scheduledWork: { findUnique: vi.fn() }, student: { findUnique: vi.fn() }, enrollment: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "hash-learner", role: "STUDENT", schoolId: "hash-school" })) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: vi.fn(), studentSessionSummary: vi.fn() }));
vi.mock("@/lib/media/blobStorage", () => ({ signHero: vi.fn(async () => null), signInlineIllustrations: vi.fn(async () => []) }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: vi.fn() }));
vi.mock("@/lib/certificates/autoAwardCertificate", () => ({ checkAndAwardCertificate: vi.fn() }));
vi.mock("@/lib/intelligence/actionEngine", () => ({ resolveActionsOnLessonComplete: vi.fn() }));
vi.mock("@/lib/lesson-notifications", () => ({ notifyLessonCompletion: vi.fn() }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: vi.fn() }));
vi.mock("@/lib/gamification/streakService", () => ({ updateStreak: vi.fn() }));
vi.mock("@/lib/mastery/resolveStrand", () => ({ resolveMasteryStrandForLesson: vi.fn() }));
import { POST } from "@/app/api/student/sync/route";
import { GET as readWork } from "@/app/api/student/work/[scheduledWorkId]/route";
import { POST as completeOnline } from "@/app/api/student/lessons/[id]/complete/route";
import { enqueueOfflineOperation, getQueue } from "@/lib/offline-queue";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
import "fake-indexeddb/auto";
import { clear, set } from "idb-keyval";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolveSessionPartition } from "@/lib/offline-session";
import { afterEach } from "vitest";

function operation(contentHash: string | null, contentVersion = "1") {
  return { protocolVersion: 1, operationId: "hash-server-operation", idempotencyKey: "hash-server-operation",
    learnerId: "hash-learner", schoolId: "hash-school", resourceType: "lesson_progress", resourceId: "hash-work",
    operationType: "progress.complete", contentId: "hash-content", contentVersion, contentHash,
    manifestSequence: null, baseServerVersion: null, dependencyIds: [],
    payload: { scheduledWorkId: "hash-work" }, clientCreatedAt: "2026-11-14T15:00:00.000Z" };
}
async function send(contentHash: string | null, contentVersion = "1") {
  const response = await POST(new NextRequest("http://localhost/api/student/sync", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ protocolVersion: 1, items: [operation(contentHash, contentVersion)] }),
  }));
  expect(response.status).toBe(200);
  return (await response.json()).results[0];
}
beforeEach(async () => {
  await clear();
  vi.clearAllMocks();
  db.curriculumContent.findUnique.mockResolvedValue({ contentId: "hash-content", hash: "a".repeat(64), version: "1", status: "published", provenance: null });
});
afterEach(() => { vi.unstubAllGlobals(); });
function work(status: string, hash: string) {
  return { id: "hash-work", classId: "hash-class", contentId: "hash-content",
    class: { id: "hash-class", schoolId: "hash-school", gradeLevel: 2, subject: "MATH" },
    content: { id: "hash-content-row", contentId: "hash-content", contentType: "lesson", status, hash, version: "1",
      grade: 2, subject: "MATH", visibility: "public", schoolId: null, teacherCreated: false, provenance: null,
      payload: { title: "Synthetic hash lesson", body: "Synthetic lesson" }, audioAssets: [], videoSupplements: [] },
    progress: [{ startedAt: new Date(), completedAt: null }],
  };
}
it.each(["APPROVED", "published"])("delivers %s legacy hashes unchanged and reproduces pre-server refusal", async status => {
  for (const hash of ["b".repeat(40), "c".repeat(16), "synthetic-legacy-hash"]) {
    await clear();
    db.student.findUnique.mockResolvedValue({ id: "hash-student" });
    db.enrollment.findUnique.mockResolvedValue({ id: "hash-enrollment" });
    db.scheduledWork.findUnique.mockResolvedValue(work(status, hash));
    const response = await readWork(new NextRequest("http://localhost/api/student/work/hash-work"), { params: Promise.resolve({ scheduledWorkId: "hash-work" }) });
    expect(response.status).toBe(200);
    const delivered = await response.json();
    expect(delivered.contentHash).toBe(hash);
    const partition = { userId: "hash-learner", schoolId: "hash-school", deviceId: "hash-device" };
    await enqueueOfflineOperation({ resourceType: "lesson_progress", resourceId: delivered.id, operationType: "progress.complete",
      contentId: delivered.contentId, contentVersion: delivered.contentVersion, contentHash: delivered.contentHash,
      payload: { scheduledWorkId: delivered.id }, clientCreatedAt: "2026-11-14T15:00:00.000Z" }, partition);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await flushSubmissionQueue(partition)).failed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await getQueue(partition))[0]).toMatchObject({ contentHash: hash, status: "failed", lastError: "invalid_offline_operation" });
  }
});
it.each(["needs_review", "PUBLISHED"])("does not deliver legacy status %s", async status => {
  db.student.findUnique.mockResolvedValue({ id: "hash-student" });
  db.scheduledWork.findUnique.mockResolvedValue(work(status, "b".repeat(40)));
  const response = await readWork(new NextRequest("http://localhost/api/student/work/hash-work"), { params: Promise.resolve({ scheduledWorkId: "hash-work" }) });
  expect(response.status).toBe(404);
});
it.each(["b".repeat(40), "c".repeat(16), "synthetic-legacy-hash"])("online completion accepts legacy work without validating stored hash %s", async hash => {
  db.student.findUnique.mockResolvedValue({ id: "hash-student" });
  db.enrollment.findUnique.mockResolvedValue({ id: "hash-enrollment" });
  db.scheduledWork.findUnique.mockResolvedValue(work("APPROVED", hash));
  const now = new Date("2026-11-14T15:00:00.000Z");
  db.studentProgress.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
    id: "hash-progress", completedAt: now, exitTicketScore: null,
    masteryEffectAt: now, progressionEffectAt: now, streakEffectAt: now, guardianNotifiedAt: now,
  });
  db.studentProgress.createMany.mockResolvedValue({ count: 1 });
  db.studentProgress.updateMany.mockResolvedValue({ count: 1 });
  const response = await completeOnline(new NextRequest("http://localhost/api/student/lessons/hash-work/complete", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ exitTicketAnswers: [] }),
  }), { params: { id: "hash-work" } });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, completedAt: now.toISOString() });
  expect(db.studentProgress.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ completedAt: expect.any(Date) }) }));
});
it.each(["b".repeat(40), "c".repeat(16), "synthetic-legacy-hash"])("service worker sends %s once, server refuses it, and work remains failed", async contentHash => {
  const partition = { userId: "hash-learner", schoolId: "hash-school", deviceId: "hash-device" };
  await set("liberialearn_active_partition", { key: resolveSessionPartition(partition).key });
  const queued = await enqueueOfflineOperation({ resourceType: "lesson_progress", resourceId: "hash-work", operationType: "progress.complete",
    contentId: "hash-content", contentVersion: "1", contentHash, payload: { scheduledWorkId: "hash-work" }, clientCreatedAt: "2026-11-14T15:00:00.000Z" }, partition);
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => POST(new NextRequest("http://localhost/api/student/sync", init)));
  const clients = { matchAll: async () => [] };
  const context = { indexedDB, fetch: fetchMock, self: { addEventListener: () => {}, clients, location: { origin: "http://localhost" } }, clients, console, URL, TextEncoder, setTimeout, clearTimeout };
  const source = readFileSync("public/sw.js", "utf8");
  await runInNewContext(`${source}\nflushOfflineQueue();`, context);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).items[0]).toMatchObject({ operationId: queued.operationId, contentHash });
  expect((await getQueue(partition))[0]).toMatchObject({ operationId: queued.operationId, contentHash, status: "failed", syncState: "TERMINAL_FAILURE", lastError: "malformed_offline_operation" });
  expect(db.studentProgress.upsert).not.toHaveBeenCalled();
});
it.each(["b".repeat(40), "c".repeat(16), "synthetic-legacy-hash"])("direct legacy-hash request is refused before writes: %s", async hash => {
  expect(await send(hash)).toMatchObject({ status: "rejected", resolutionHint: "malformed_offline_operation" });
  expect(db.curriculumContent.findUnique).not.toHaveBeenCalled();
  expect(db.studentProgress.upsert).not.toHaveBeenCalled();
});
it("keeps exact hash comparison for same-version content", async () => {
  expect(await send("b".repeat(64))).toMatchObject({ status: "conflict", resolutionHint: "content_hash_mismatch" });
  expect(db.studentProgress.upsert).not.toHaveBeenCalled();
});
it("keeps content-version comparison", async () => {
  expect(await send("a".repeat(64), "old")).toMatchObject({ status: "conflict", resolutionHint: "content_version_changed" });
});
it("null passes syntax but cannot bypass a stored release hash", async () => {
  expect(await send(null)).toMatchObject({ status: "rejected", resolutionHint: "lesson_release_identity_required" });
});
