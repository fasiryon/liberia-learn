// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clear } from "idb-keyval";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { enqueueOfflineOperation, getQueue, markSyncTerminalFailure } from "@/lib/offline-queue";
import { resolveSessionPartition, setActiveSessionPartition } from "@/lib/offline-session";
import SyncManager from "@/app/student/SyncManager";
import OfflineStatus from "@/app/student/offline-status/page";

vi.mock("@/lib/offline-session", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/offline-session")>();
  return { ...actual, detectAndSetActiveSessionPartition: vi.fn(async () => actual.resolveSessionPartition()) };
});
vi.mock("@/lib/offline/syncDiagnosticsReporter", () => ({
  reportSyncDiagnostics: vi.fn(), scheduleSyncDiagnosticsReport: vi.fn(),
}));

const partition = { userId: "hash-ui-learner", schoolId: "hash-ui-school", deviceId: "hash-ui-device" };
let host: HTMLDivElement;
let root: Root;
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    if (check()) return;
  }
  throw new Error(`Component did not reach expected state: ${host.textContent}`);
}
beforeEach(async () => {
  await clear();
  setActiveSessionPartition(partition);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => { root.unmount(); }); host.remove(); vi.unstubAllGlobals(); });

it.each(["a".repeat(40), "b".repeat(16), "synthetic-legacy-hash"])("renders visible failure and keeps explicit retries for %s", async contentHash => {
  const queued = await enqueueOfflineOperation({
    resourceType: "lesson_progress", operationType: "progress.complete", resourceId: "hash-ui-work",
    contentId: "hash-ui-content", contentVersion: "1", contentHash,
    payload: { scheduledWorkId: "hash-ui-work" }, clientCreatedAt: "2026-11-14T15:00:00.000Z",
  }, resolveSessionPartition());
  if (contentHash.length === 40) await markSyncTerminalFailure([queued.id], "invalid_offline_operation", partition);
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, redirected: false, json: async () => ({ results: [{ status: "synced" }] }) }));
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => { root.render(<SyncManager isPlatformAdmin={false} />); });
  await until(() => /Could not send\. Your work is still saved on this device/.test(host.textContent ?? ""));
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await getQueue(partition))[0]).toMatchObject({ operationId: queued.operationId, status: "failed", lastError: "invalid_offline_operation" });
  await act(async () => { host.querySelector("button")?.click(); });
  if (contentHash.length === 40) {
    await until(() => /1 item sent/.test(host.textContent ?? ""));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getQueue(partition)).toHaveLength(0);
    await act(async () => { root.render(<OfflineStatus />); });
    await until(() => /Everything has been sent/.test(host.textContent ?? ""));
    return;
  }
  await until(() => /Try again/.test(host.textContent ?? ""));
  expect((await getQueue(partition))[0].status).toBe("failed");
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => { root.render(<OfflineStatus />); });
  await until(() => /Not sent yet/.test(host.textContent ?? ""));
  expect(host.textContent).toContain("Lesson work");
  expect(host.textContent).not.toMatch(/studentProgress|failed|sending|sync/i);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
  await act(async () => { host.querySelector("button")?.click(); });
  await until(() => /Still not sent\. Your work is safe on this device\. If this keeps happening, tell your teacher\./.test(host.textContent ?? ""))
  expect((await getQueue(partition))[0].operationId).toBe(queued.operationId);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("announces pending work without exposing an entity or raw sending state", async () => {
  await enqueueOfflineOperation({ resourceType: "lesson_progress", resourceId: "pending-lesson", operationType: "progress.complete",
    contentId: "pending-content", contentVersion: "1", contentHash: "a".repeat(40), payload: {} }, partition);
  await act(async () => { root.render(<OfflineStatus />); });
  await until(() => /Waiting to send/.test(host.textContent ?? ""));
  expect(host.textContent).toContain("Lesson work");
  expect(host.textContent).toContain("Saved on this device.");
  expect(host.textContent).not.toMatch(/studentProgress|pending|sending|failed|sync/i);
  expect(host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
});
