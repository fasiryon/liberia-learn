import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockSchoolCount = vi.hoisted(() => vi.fn());
const mockQueryRaw    = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { count: mockSchoolCount },
    $queryRaw: mockQueryRaw,
  },
}));

import { GET } from "@/app/api/health/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupHealthyDefaults() {
  mockSchoolCount.mockResolvedValue(5);
  // checkMigrations: 0 pending rows
  mockQueryRaw.mockImplementation(async () => [{ pending: 0n }]);
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.AT_API_KEY     = "at-test-key";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.AT_API_KEY;
    setupHealthyDefaults();
  });

  // ── Healthy ─────────────────────────────────────────────────────────────────

  it("returns 200 with status=healthy when all checks pass", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.migrations).toBe("ok");
    expect(body.checks.aiFactory).toBe("ok");
    expect(body.checks.sms).toBe("ok");
  });

  it("includes version 1.0.0", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.version).toBe("1.0.0");
  });

  it("includes ISO timestamp", async () => {
    const res = await GET();
    const body = await res.json();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  // ── Degraded: AI key missing ─────────────────────────────────────────────

  it("returns 200 with status=degraded when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.aiFactory).toBe("unavailable");
    expect(body.checks.database).toBe("ok");
  });

  // ── Degraded: SMS key missing ────────────────────────────────────────────

  it("returns 200 with status=degraded when AT_API_KEY is absent", async () => {
    delete process.env.AT_API_KEY;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.sms).toBe("unavailable");
  });

  // ── Degraded: pending migrations ────────────────────────────────────────

  it("returns 200 with status=degraded when unapplied migrations exist", async () => {
    mockQueryRaw.mockImplementation(async () => [{ pending: 2n }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.migrations).toBe("pending");
  });

  // ── Unhealthy: database down ─────────────────────────────────────────────

  it("returns 503 when database is unreachable", async () => {
    mockSchoolCount.mockRejectedValue(new Error("ECONNREFUSED"));
    mockQueryRaw.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("error");
  });

  it("reports migrations as error when query fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("relation does not exist"));

    const res = await GET();
    const body = await res.json();
    expect(body.checks.migrations).toBe("error");
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it("does not require authentication — public route", async () => {
    // No auth mocks set up — the route should still succeed
    const res = await GET();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  it("response body always contains status, version, timestamp, checks", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("checks");
    expect(body.checks).toHaveProperty("database");
    expect(body.checks).toHaveProperty("migrations");
    expect(body.checks).toHaveProperty("aiFactory");
    expect(body.checks).toHaveProperty("sms");
  });
});
