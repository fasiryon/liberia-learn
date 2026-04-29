import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockRequireUser = vi.hoisted(() => vi.fn());
const mockEnqueue = vi.hoisted(() => vi.fn());
const mockClaim = vi.hoisted(() => vi.fn());
const mockProcess = vi.hoisted(() => vi.fn());
const mockRetry = vi.hoisted(() => vi.fn());
const mockStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audio/audioGenerationQueue", () => ({
  enqueueLessonAudio: mockEnqueue,
  claimNextAudioJobs: mockClaim,
  processAudioJob: mockProcess,
  retryFailedJobs: mockRetry,
  getAudioQueueStatus: mockStatus,
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(search = "") {
  return new Request(`http://localhost${search}`, { method: "GET" });
}

describe("POST /api/admin/audio-generation/enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("rejects unauthenticated requests", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const { POST } = await import("@/app/api/admin/audio-generation/enqueue/route");

    const res = await POST(makeRequest({ grade: 5, subject: "ENGLISH" }));

    expect(res.status).toBe(401);
  });

  it("returns 400 when grade or subject is missing", async () => {
    const { POST } = await import("@/app/api/admin/audio-generation/enqueue/route");

    const res = await POST(makeRequest({ subject: "ENGLISH" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/grade/i);
  });

  it("calls enqueueLessonAudio and returns result", async () => {
    mockEnqueue.mockResolvedValueOnce({ queued: 12, skipped: 3, total: 15 });
    const { POST } = await import("@/app/api/admin/audio-generation/enqueue/route");

    const res = await POST(makeRequest({ grade: 5, subject: "ENGLISH", limit: 50 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ queued: 12, skipped: 3, total: 15 });
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 5, subject: "ENGLISH", limit: 50 })
    );
  });
});

describe("POST /api/admin/audio-generation/process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("rejects unauthenticated requests", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const { POST } = await import("@/app/api/admin/audio-generation/process/route");

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(401);
  });

  it("returns empty results when no PENDING jobs", async () => {
    mockClaim.mockResolvedValueOnce([]);
    const { POST } = await import("@/app/api/admin/audio-generation/process/route");

    const res = await POST(makeRequest({ limit: 3 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ processed: 0, failed: 0, results: [] });
  });

  it("processes claimed jobs and returns counts", async () => {
    mockClaim.mockResolvedValueOnce([
      { id: "job-1", lessonId: "l1", voice: "alloy", contentVersion: "v1" },
      { id: "job-2", lessonId: "l2", voice: "alloy", contentVersion: "v1" },
    ]);
    mockProcess
      .mockResolvedValueOnce({ jobId: "job-1", lessonId: "l1", status: "GENERATED", url: "https://cdn/l1.mp3" })
      .mockResolvedValueOnce({ jobId: "job-2", lessonId: "l2", status: "FAILED", error: "TTS error" });
    const { POST } = await import("@/app/api/admin/audio-generation/process/route");

    const res = await POST(makeRequest({ limit: 3 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ processed: 1, failed: 1 });
    expect(data.results).toHaveLength(2);
  });
});

describe("GET /api/admin/audio-generation/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("rejects unauthenticated requests", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const { GET } = await import("@/app/api/admin/audio-generation/status/route");

    const res = await GET(makeGetRequest("?grade=5&subject=ENGLISH"));

    expect(res.status).toBe(401);
  });

  it("returns queue status with grade/subject filter", async () => {
    mockStatus.mockResolvedValueOnce({
      pending: 5,
      processing: 1,
      generated: 42,
      failed: 2,
      lastProcessed: "2026-04-29T10:00:00.000Z",
      totalCostUsd: 0.0063,
    });
    const { GET } = await import("@/app/api/admin/audio-generation/status/route");

    const res = await GET(makeGetRequest("?grade=5&subject=ENGLISH"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ pending: 5, generated: 42 });
    expect(mockStatus).toHaveBeenCalledWith({ grade: 5, subject: "ENGLISH" });
  });
});

describe("POST /api/admin/audio-generation/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("rejects unauthenticated requests", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const { POST } = await import("@/app/api/admin/audio-generation/retry/route");

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(401);
  });

  it("calls retryFailedJobs and returns count", async () => {
    mockRetry.mockResolvedValueOnce({ retried: 4 });
    const { POST } = await import("@/app/api/admin/audio-generation/retry/route");

    const res = await POST(makeRequest({ grade: 5, subject: "ENGLISH" }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ retried: 4 });
    expect(mockRetry).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 5, subject: "ENGLISH" })
    );
  });
});

describe("POST /api/cron/process-audio-generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret-123");
  });

  it("rejects requests with no Authorization header", async () => {
    const { POST } = await import("@/app/api/cron/process-audio-generation/route");

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong secret", async () => {
    const { POST } = await import("@/app/api/cron/process-audio-generation/route");

    const res = await POST(makeRequest({}, { Authorization: "Bearer wrong-secret" }));

    expect(res.status).toBe(401);
  });

  it("processes jobs when CRON_SECRET matches", async () => {
    mockClaim.mockResolvedValueOnce([
      { id: "job-1", lessonId: "l1", voice: "alloy", contentVersion: "v1" },
    ]);
    mockProcess.mockResolvedValueOnce({
      jobId: "job-1",
      lessonId: "l1",
      status: "GENERATED",
      url: "https://cdn/l1.mp3",
    });
    const { POST } = await import("@/app/api/cron/process-audio-generation/route");

    const res = await POST(
      makeRequest({ limit: 3 }, { Authorization: "Bearer test-cron-secret-123" })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ processed: 1, failed: 0 });
  });

  it("returns empty result when no PENDING jobs exist", async () => {
    mockClaim.mockResolvedValueOnce([]);
    const { POST } = await import("@/app/api/cron/process-audio-generation/route");

    const res = await POST(
      makeRequest({}, { Authorization: "Bearer test-cron-secret-123" })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ processed: 0, failed: 0, results: [] });
  });
});
