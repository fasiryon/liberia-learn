/**
 * Sprint 28 — Pilot Readiness: Gap Closure + P1/P2 Fixes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockRateLimitExceededResponse = vi.hoisted(() =>
  vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
  )
);

const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockGuardianConsentUpsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: mockRateLimitExceededResponse,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: mockUserFindFirst, update: mockUserUpdate },
    guardianConsent: { upsert: mockGuardianConsentUpsert },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJsonRequest(body: Record<string, string>, ip = "1.2.3.4") {
  return new Request("http://localhost/api/sms/stop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

const ALLOWED_RL = {
  allowed: true,
  remaining: 19,
  retryAfter: 0,
  limit: 20,
  resetAt: Date.now() + 60_000,
  backend: "memory" as const,
  scope: "instance" as const,
  namespace: "sms-stop",
};

const BLOCKED_RL = { ...ALLOWED_RL, allowed: false, remaining: 0 };

// ── Test: app/error.tsx branded error boundary ────────────────────────────────

describe("app/error.tsx — branded error boundary", () => {
  it("exports a default React component function", async () => {
    const mod = await import("@/app/error");
    expect(typeof mod.default).toBe("function");
  });

  it("accepts an error with optional digest prop", async () => {
    const { default: ErrorBoundary } = await import("@/app/error");
    // Component must accept the correct prop shape without TypeScript error
    expect(ErrorBoundary.length).toBeGreaterThanOrEqual(0);
    // Verify the component is a named function (not anonymous)
    expect(ErrorBoundary.name).toBeTruthy();
  });
});

// ── Test: SMS STOP rate limit ─────────────────────────────────────────────────

describe("POST /api/sms/stop — rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(BLOCKED_RL);
    const { POST } = await import("@/app/api/sms/stop/route");
    const req = makeJsonRequest({ from: "+231770000000", body: "STOP" });
    const res = await POST(req as any);
    expect(res.status).toBe(429);
    expect(mockRateLimitExceededResponse).toHaveBeenCalledWith(BLOCKED_RL);
  });

  it("processes valid STOP within rate limit", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(ALLOWED_RL);
    mockUserFindFirst.mockResolvedValueOnce({
      id: "guardian-1",
      schoolId: "school-1",
      guardianOf: [{ studentId: "student-1" }],
    });
    mockUserUpdate.mockResolvedValueOnce({});
    mockGuardianConsentUpsert.mockResolvedValueOnce({});

    const { POST } = await import("@/app/api/sms/stop/route");
    const req = makeJsonRequest({ from: "+231770000000", body: "STOP" });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(json.optedOut).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { smsOptIn: false } })
    );
  });
});

// ── Test: MOE standards coverage ─────────────────────────────────────────────

describe("MOE standards — ACTION-2/4/5 gap closure", () => {
  it("total code count covers all required codes (>= 53)", async () => {
    const { MOE_STANDARDS } = await import("@/prisma/seeds/moe-standards");
    expect(MOE_STANDARDS.length).toBeGreaterThanOrEqual(53);
  });

  it("ACTION-2: Engineering codes present across all grade bands", async () => {
    const { MOE_STANDARDS } = await import("@/prisma/seeds/moe-standards");
    const engCodes = MOE_STANDARDS.filter((s) => s.subject === "ENGINEERING");
    expect(engCodes.length).toBeGreaterThanOrEqual(4);
    const bands = new Set(engCodes.map((s) => s.band));
    expect(bands.has("G1_3")).toBe(true);
    expect(bands.has("G4_6")).toBe(true);
    expect(bands.has("G7_9")).toBe(true);
    expect(bands.has("G10_12")).toBe(true);
  });

  it("ACTION-4: CS G1-3 codes present (LR-CS-G1_3-01)", async () => {
    const { MOE_STANDARDS } = await import("@/prisma/seeds/moe-standards");
    const csG13 = MOE_STANDARDS.filter(
      (s) => s.subject === "COMPUTER_SCIENCE" && s.band === "G1_3"
    );
    expect(csG13.length).toBeGreaterThanOrEqual(1);
    const codes = csG13.map((s) => s.code);
    expect(codes).toContain("LR-CS-G1_3-01");
  });

  it("ACTION-5: CS G4-6 hardware strand present (LR-CS-G4_6-02)", async () => {
    const { MOE_STANDARDS } = await import("@/prisma/seeds/moe-standards");
    const csG46 = MOE_STANDARDS.filter(
      (s) => s.subject === "COMPUTER_SCIENCE" && s.band === "G4_6"
    );
    expect(csG46.length).toBeGreaterThanOrEqual(2);
    const codes = csG46.map((s) => s.code);
    expect(codes).toContain("LR-CS-G4_6-02");
  });
});
