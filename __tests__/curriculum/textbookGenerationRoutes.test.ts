import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockEnqueue = vi.hoisted(() => vi.fn());
const mockClaim = vi.hoisted(() => vi.fn());
const mockProcess = vi.hoisted(() => vi.fn());
const mockRetry = vi.hoisted(() => vi.fn());
const mockStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/textbooks/textbookGenerationQueue", () => ({
  enqueueTextbook: mockEnqueue,
  claimNextTextbookJobs: mockClaim,
  processTextbookJob: mockProcess,
  retryFailed: mockRetry,
  getTextbookQueueStatus: mockStatus,
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("textbook generation admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("enforces ADMIN auth on enqueue", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { POST } = await import("@/app/api/admin/textbook-generation/enqueue/route");

    const res = await POST(makeRequest({ grade: 5, subject: "ENGLISH", format: "student" }));

    expect(res.status).toBe(403);
  });

  it("enqueues a textbook job", async () => {
    mockEnqueue.mockResolvedValueOnce({ queued: 1, skipped: 0, jobId: "job-1" });
    const { POST } = await import("@/app/api/admin/textbook-generation/enqueue/route");

    const res = await POST(makeRequest({ grade: 5, subject: "ENGLISH", format: "student" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ queued: 1, jobId: "job-1" });
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      grade: 5,
      subject: "ENGLISH",
      format: "student",
      requestedById: "admin-1",
    }));
  });

  it("processes claimed jobs", async () => {
    mockClaim.mockResolvedValueOnce([{ id: "job-1", grade: 5, subject: "ENGLISH", format: "student", version: "v1" }]);
    mockProcess.mockResolvedValueOnce({ jobId: "job-1", status: "GENERATED", url: "https://cdn/textbook.pdf" });
    const { POST } = await import("@/app/api/admin/textbook-generation/process/route");

    const res = await POST(makeRequest({ limit: 12 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ processed: 1, failed: 0 });
  });

  it("retries failed jobs", async () => {
    mockRetry.mockResolvedValueOnce({ retried: 3 });
    const { POST } = await import("@/app/api/admin/textbook-generation/retry/route");

    const res = await POST(makeRequest({ grade: 5, subject: "ENGLISH", format: "student" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retried: 3 });
  });

  it("returns queue status", async () => {
    mockStatus.mockResolvedValueOnce({ pending: 1, processing: 0, generated: 2, failed: 0, lastProcessed: null, estimatedCostUsd: 0 });
    const { GET } = await import("@/app/api/admin/textbook-generation/status/route");

    const res = await GET(new Request("http://localhost?grade=5&format=student"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pending: 1, generated: 2 });
  });
});

describe("POST /api/cron/process-textbook-generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
  });

  it("protects the cron route with CRON_SECRET", async () => {
    const { POST } = await import("@/app/api/cron/process-textbook-generation/route");

    const res = await POST(makeRequest({ limit: 12 }));

    expect(res.status).toBe(401);
  });

  it("processes when the cron secret matches", async () => {
    mockClaim.mockResolvedValueOnce([{ id: "job-1", grade: 5, subject: "ENGLISH", format: "student", version: "v1" }]);
    mockProcess.mockResolvedValueOnce({ jobId: "job-1", status: "GENERATED" });
    const { POST } = await import("@/app/api/cron/process-textbook-generation/route");

    const res = await POST(makeRequest({ limit: 12 }, { Authorization: "Bearer test-cron-secret" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ processed: 1, failed: 0 });
  });
});
