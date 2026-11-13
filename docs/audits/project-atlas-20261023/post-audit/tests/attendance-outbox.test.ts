import { beforeEach, expect, it, vi } from "vitest";
import type { OfflineOperation } from "@/lib/offline/syncProtocol";
const mocks = vi.hoisted(() => ({ conflict: vi.fn(), terminal: vi.fn(), success: vi.fn() }));
const operation: OfflineOperation = { protocolVersion: 1, operationId: "synthetic-attendance", learnerId: "synthetic-user", schoolId: "synthetic-school", resourceType: "attendance", resourceId: "synthetic-meeting", operationType: "attendance.mark", payload: { status: "PRESENT" }, contentId: null, contentVersion: null, contentHash: null, baseServerVersion: null, manifestSequence: null, clientCreatedAt: "2026-10-23T10:00:00.000Z", idempotencyKey: "synthetic-attendance", dependencyIds: [] };
vi.mock("@/lib/offline-queue", () => ({
  getReadyQueue: async () => [{ id: "synthetic-outbox-row", payload: { status: "PRESENT" } }],
  toSyncOperation: () => operation,
  markSyncSending: vi.fn(), markSyncConflict: mocks.conflict,
  markSyncTerminalFailure: mocks.terminal, markSyncSuccess: mocks.success,
  markSyncFailure: vi.fn(), markSyncAuthRequired: vi.fn(), markSyncDeferred: vi.fn(), releaseSendingLeases: vi.fn(),
}));
vi.mock("@/lib/offline-session", () => ({ resolveSessionPartition: () => ({ userId: "synthetic-user" }) }));
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
beforeEach(() => vi.clearAllMocks());
it("control: an attendance-authority conflict retains the device observation for review", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ synced: 0, results: [{ status: "conflict", entity: "attendance", resolutionHint: "attendance_requires_teacher_review" }] })));
  const result = await flushSubmissionQueue();
  expect(result).toMatchObject({ conflicts: 1, flushed: 0, failed: 0 });
  expect(mocks.conflict).toHaveBeenCalledWith([expect.objectContaining({ id: "synthetic-outbox-row", clientState: { status: "PRESENT" }, resolutionHint: "attendance_requires_teacher_review" })], undefined);
  expect(mocks.terminal).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
});
