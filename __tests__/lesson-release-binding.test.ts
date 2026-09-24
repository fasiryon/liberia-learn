/**
 * Offline hardening V1: lesson completion is bound to the exact released
 * CurriculumContent (contentId + version + hash). Completions recorded
 * offline against a missing, older, or different release never write
 * progress, and operations without a learner binding are refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    learningEvent: { findFirst: vi.fn() },
    student: { findUnique: vi.fn() },
    scheduledWork: { findFirst: vi.fn() },
    studentProgress: { findUnique: vi.fn(), upsert: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));

import { POST as sync } from "@/app/api/student/sync/route";
import { prisma } from "@/lib/db";

const HASH_V2 = "a".repeat(64);
const HASH_V1 = "b".repeat(64);

function completion(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    operationId: "completion-op-0001",
    idempotencyKey: "completion-op-0001",
    learnerId: "student-1",
    schoolId: "school-1",
    resourceType: "lesson_progress",
    resourceId: "sw-1",
    operationType: "progress.complete",
    contentId: "content-1",
    contentVersion: "2",
    contentHash: HASH_V2,
    manifestSequence: null,
    payload: { scheduledWorkId: "sw-1", clientUpdatedAt: "2026-09-23T10:00:00.000Z" },
    clientCreatedAt: "2026-09-23T10:00:00.000Z",
    baseServerVersion: null,
    dependencyIds: [],
    ...overrides,
  };
}

async function syncOnce(item: Record<string, unknown>) {
  const response = await sync(new NextRequest("http://localhost/api/student/sync", {
    method: "POST",
    body: JSON.stringify({ protocolVersion: 1, items: [item] }),
    headers: { "Content-Type": "application/json" },
  }));
  return (await response.json()).results[0];
}

describe("lesson completion release binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.curriculumContent.findUnique as any).mockResolvedValue({
      contentId: "content-1",
      version: "2",
      hash: HASH_V2,
      status: "published",
      provenance: { lifecycleState: "PUBLISHED" },
    });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "student-rec-1" });
    (prisma.scheduledWork.findFirst as any).mockResolvedValue({ id: "sw-1", contentId: "content-1" });
    (prisma.learningEvent.findFirst as any).mockResolvedValue(null);
  });

  it("rejects a completion that carries no release identity", async () => {
    const result = await syncOnce(completion({ contentId: null, contentVersion: null, contentHash: null }));
    expect(result).toMatchObject({ status: "rejected", resolutionHint: "lesson_release_identity_required" });
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });

  it("rejects a completion without a version or without the published hash", async () => {
    expect(await syncOnce(completion({ contentVersion: null }))).toMatchObject({ resolutionHint: "lesson_release_identity_required" });
    expect(await syncOnce(completion({ contentHash: null }))).toMatchObject({ resolutionHint: "lesson_release_identity_required" });
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });

  it("holds a completion made offline against an older release as a conflict", async () => {
    const result = await syncOnce(completion({ contentVersion: "1", contentHash: HASH_V1 }));
    expect(result).toMatchObject({ status: "conflict", resolutionHint: "content_version_changed" });
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });

  it("holds a completion whose bytes differ from the published release", async () => {
    const result = await syncOnce(completion({ contentHash: HASH_V1 }));
    expect(result).toMatchObject({ status: "conflict", resolutionHint: "content_hash_mismatch" });
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });

  it("rejects a completion replayed against a different lesson's content", async () => {
    (prisma.curriculumContent.findUnique as any).mockResolvedValue({
      contentId: "content-other", version: "2", hash: HASH_V2, status: "published", provenance: null,
    });
    const result = await syncOnce(completion({ contentId: "content-other" }));
    expect(result).toMatchObject({ status: "rejected", resolutionHint: "scheduled_work_tenant_or_content_mismatch" });
  });

  it("refuses canonical work that has no learner binding", async () => {
    const result = await syncOnce(completion({ learnerId: null }));
    expect(result).toMatchObject({ status: "rejected", resolutionHint: "learner_identity_unbound" });
  });

  it("accepts a completion bound to the current published release", async () => {
    (prisma.studentProgress.findUnique as any).mockResolvedValue(null);
    (prisma.studentProgress.upsert as any).mockResolvedValue({});
    const result = await syncOnce(completion());
    expect(result.status).not.toBe("rejected");
    expect(result.status).not.toBe("conflict");
  });
});
