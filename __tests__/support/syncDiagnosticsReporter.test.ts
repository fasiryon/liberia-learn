import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/offline-queue", () => ({ getQueue: vi.fn(async () => []) }));
vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: (p?: { userId?: string }) => ({ key: `u:${p?.userId ?? "anon"}|s:school|d:device` }),
}));

type Reporter = typeof import("@/lib/offline/syncDiagnosticsReporter");

function respond(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe("sync diagnostics reporter", () => {
  let reporter: Reporter;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    reporter = await import("@/lib/offline/syncDiagnosticsReporter");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("suppresses an unchanged repeat only after the server recorded it", async () => {
    fetchMock.mockResolvedValue(respond({ recorded: true }));
    await reporter.reportSyncDiagnostics({ userId: "a" });
    await reporter.reportSyncDiagnostics({ userId: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not treat a rate-limited report as recorded and retries after the window", async () => {
    fetchMock.mockResolvedValueOnce(respond({ recorded: false, reason: "rate_limited" }));
    fetchMock.mockResolvedValue(respond({ recorded: true }));
    await reporter.reportSyncDiagnostics({ userId: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await reporter.reportSyncDiagnostics({ userId: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps deduplication per learner partition on a shared device", async () => {
    fetchMock.mockResolvedValue(respond({ recorded: true }));
    await reporter.reportSyncDiagnostics({ userId: "a" });
    await reporter.reportSyncDiagnostics({ userId: "b" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces a burst of queue changes into one report", async () => {
    fetchMock.mockResolvedValue(respond({ recorded: true }));
    for (let i = 0; i < 5; i++) reporter.scheduleSyncDiagnosticsReport({ userId: "a" });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
