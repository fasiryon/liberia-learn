import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Token utility tests ──────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({ prisma: {} }));

describe("liveToken", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LIVE_DASHBOARD_SECRET = "test-secret-abc123";
  });
  afterEach(() => {
    delete process.env.LIVE_DASHBOARD_SECRET;
  });

  it("generates a token that verifies successfully", async () => {
    const { generateLiveToken, verifyLiveToken } = await import("@/lib/moe/liveToken");
    const { token } = generateLiveToken();
    expect(verifyLiveToken(token)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const { generateLiveToken, verifyLiveToken } = await import("@/lib/moe/liveToken");
    const { token } = generateLiveToken();
    const tampered = token.slice(0, -3) + "xxx";
    expect(verifyLiveToken(tampered)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const { verifyLiveToken } = await import("@/lib/moe/liveToken");
    const { createHmac } = await import("crypto");
    const expiry = Date.now() - 1000; // already expired
    const payload = `moe-live:${expiry}`;
    const sig = createHmac("sha256", "test-secret-abc123").update(payload).digest("hex");
    const token = Buffer.from(`${expiry}.${sig}`).toString("base64url");
    expect(verifyLiveToken(token)).toBe(false);
  });

  it("rejects garbage input", async () => {
    const { verifyLiveToken } = await import("@/lib/moe/liveToken");
    expect(verifyLiveToken("")).toBe(false);
    expect(verifyLiveToken("notavalidtoken")).toBe(false);
    expect(verifyLiveToken("abc.def")).toBe(false);
  });

  it("token includes correct expiresAt (4h from now)", async () => {
    const { generateLiveToken } = await import("@/lib/moe/liveToken");
    const before = Date.now();
    const { expiresAt } = generateLiveToken();
    const after = Date.now();
    const exp = new Date(expiresAt).getTime();
    expect(exp).toBeGreaterThanOrEqual(before + 4 * 60 * 60 * 1000 - 100);
    expect(exp).toBeLessThanOrEqual(after + 4 * 60 * 60 * 1000 + 100);
  });
});

// ── Live API route tests ─────────────────────────────────────────────────────

describe("GET /api/moe/live", () => {
  const mockLiveDashboardData = {
    national: { activeNow: 42, totalEnrolled: 500, schoolsLive: 12, countiesLive: 6 },
    today: { completionPct: 74, lessonsOpened: 180, quizzesSubmitted: 95 },
    counties: [{ name: "Montserrado", completionPct: 82, activeStudents: 0 }],
    recent: [
      {
        studentInitial: "Pewu W.",
        grade: "G7",
        lessonTitle: "Fractions",
        schoolName: "Capitol Hill Academy",
        completedAt: new Date().toISOString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/moe/liveDashboard", () => ({
      getLiveDashboardData: vi.fn(async () => mockLiveDashboardData),
    }));
    vi.doMock("@/lib/moe/liveToken", () => ({
      verifyLiveToken: vi.fn((t: string) => t === "valid-token"),
    }));
    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => { throw new Error("no redis"); } },
    }));
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 with no auth", async () => {
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));

    const { GET } = await import("@/app/api/moe/live/route");
    const req = new Request("http://localhost/api/moe/live");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns data for MOE_OFFICIAL session", async () => {
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn(async () => ({
        user: { role: "MOE_OFFICIAL", isPlatformAdmin: false },
      })),
    }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));

    const { GET } = await import("@/app/api/moe/live/route");
    const req = new Request("http://localhost/api/moe/live");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.national.activeNow).toBe(42);
    expect(body.today.completionPct).toBe(74);
    expect(body.counties).toHaveLength(1);
  });

  it("returns data for valid signed token without session", async () => {
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));

    const { GET } = await import("@/app/api/moe/live/route");
    const req = new Request("http://localhost/api/moe/live?token=valid-token");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("returns 401 for invalid token and no session", async () => {
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));

    const { GET } = await import("@/app/api/moe/live/route");
    const req = new Request("http://localhost/api/moe/live?token=bad-token");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns data for isPlatformAdmin", async () => {
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn(async () => ({
        user: { role: "ADMIN", isPlatformAdmin: true },
      })),
    }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));

    const { GET } = await import("@/app/api/moe/live/route");
    const req = new Request("http://localhost/api/moe/live");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("anonymizes student names in recent activity", async () => {
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn(async () => ({
        user: { role: "MOE_OFFICIAL", isPlatformAdmin: false },
      })),
    }));
    vi.doMock("@/lib/auth", () => ({ authOptions: {} }));

    const { GET } = await import("@/app/api/moe/live/route");
    const req = new Request("http://localhost/api/moe/live");
    const res = await GET(req);
    const body = await res.json();
    const firstRecent = body.recent[0];
    // Should have initial format: "Firstname L." or "Firstname"
    expect(firstRecent.studentInitial).toMatch(/^[A-Z][a-z]+ [A-Z]\.?$|^[A-Z][a-z]+$/);
    // Should NOT be a full last name
    expect(firstRecent.studentInitial).not.toContain("Wleh");
  });
});

// ── liveDashboard data function tests ───────────────────────────────────────

describe("getLiveDashboardData shape", () => {
  it("returns correct data shape with mocked prisma", async () => {
    const mockPrisma = {
      studentSession: {
        count: vi.fn(async () => 55),
        findMany: vi.fn(async () => []),
      },
      student: { count: vi.fn(async () => 420) },
      school: {
        findMany: vi.fn(async () => [
          { county: "Montserrado" },
          { county: "Nimba" },
          { county: null },
        ]),
      },
      homeworkSubmission: { count: vi.fn(async () => 30) },
      scheduledWork: {
        count: vi.fn(async (args: any) => {
          if (args?.where?.isDelivered) return 180;
          return 240;
        }),
        findMany: vi.fn(async () => [
          { isDelivered: true, class: { School: { county: "Montserrado" } } },
          { isDelivered: false, class: { School: { county: "Nimba" } } },
        ]),
      },
    };

    // Clear the liveDashboard mock set by API route tests, then re-import fresh
    vi.doUnmock("@/lib/moe/liveDashboard");
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({ prisma: mockPrisma }));
    const mod = await import("@/lib/moe/liveDashboard");
    const result = await mod.getLiveDashboardData();

    expect(result.national.activeNow).toBe(55);
    expect(result.national.totalEnrolled).toBe(420);
    expect(result.national.schoolsLive).toBe(3);
    expect(result.national.countiesLive).toBe(2);
    expect(result.today.completionPct).toBe(75); // 180/240 * 100
    expect(result.today.lessonsOpened).toBe(55);
    expect(result.today.quizzesSubmitted).toBe(30);
    expect(result.counties).toHaveLength(2);
    expect(result.recent).toHaveLength(0);
    expect(result.generatedAt).toBeTruthy();
  });
});
