/**
 * __tests__/monthly.report.access.test.ts
 *
 * Route-level access control tests for Block 8 monthly report endpoints.
 *
 * Covers:
 *   1. POST /api/admin/reports/monthly/generate
 *        — non-ADMIN gets 403
 *        — school ADMIN generates for own school (200)
 *        — school ADMIN denied for different school (403)
 *        — national scope denied for non-platform admin (403)
 *        — platform admin can generate national report (200)
 *        — missing month → 400
 *        — invalid month format → 400
 *        — county/district scope → 400 (not yet supported)
 *
 *   2. GET /api/admin/reports/monthly
 *        — non-ADMIN gets 403
 *        — non-platform admin cannot query national scope (403)
 *        — school admin can list own school reports (200)
 *
 *   3. GET /api/admin/reports/monthly/[id]
 *        — non-ADMIN gets 403
 *        — school admin cannot read report belonging to different school (403)
 *        — school admin cannot read national scope report (403)
 *        — platform admin can read any report (200)
 *        — report not found → 404
 *        — format=pdf with flag off → 501
 *        — format=invalid → 400
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole          = vi.hoisted(() => vi.fn());
const mockGenerateMonthlyReport = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabled     = vi.hoisted(() => vi.fn());
const mockMonthlyReportFindMany = vi.hoisted(() => vi.fn());
const mockMonthlyReportFindUnique = vi.hoisted(() => vi.fn());
const mockResolveScopeParams   = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/reporting/monthly/reportGenerator", () => ({
  generateMonthlyReport: mockGenerateMonthlyReport,
  NATIONAL_SCOPE_ID_SENTINEL: "__NATIONAL__",
}));

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("@/lib/reporting/scope", () => ({
  resolveScopeParams: mockResolveScopeParams,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    monthlyReport: {
      findMany:   mockMonthlyReportFindMany,
      findUnique: mockMonthlyReportFindUnique,
    },
  } as any,
}));

// ─── Import routes after mocks ────────────────────────────────────────────────

import { POST as generateRoute } from "@/app/api/admin/reports/monthly/generate/route";
import { GET  as listRoute }     from "@/app/api/admin/reports/monthly/route";
import { GET  as getRoute }      from "@/app/api/admin/reports/monthly/[id]/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SCHOOL_A = "school_aaa";
const SCHOOL_B = "school_bbb";

const SCHOOL_ADMIN = {
  id: "user-admin-a",
  role: "ADMIN" as const,
  schoolId: SCHOOL_A,
  isPlatformAdmin: false,
};

const PLATFORM_ADMIN = {
  id: "user-platform",
  role: "ADMIN" as const,
  schoolId: null,
  isPlatformAdmin: true,
};

const TEACHER_USER = {
  id: "user-teacher",
  role: "TEACHER" as const,
  schoolId: SCHOOL_A,
  isPlatformAdmin: false,
};

const MOCK_REPORT_ROW = {
  id: "report_xyz",
  schoolId: SCHOOL_A,
  scope: "school",
  scopeId: SCHOOL_A,
  month: "2026-01",
  subject: "__ALL__",
  status: "completed",
  proficiencyRate: 0.75,
  masteryRate: 0.45,
  avgGrowthDelta: 0.12,
  sustainabilityIndex: 0.80,
  aiRelianceRate: 0.10,
  totalStudents: 20,
  totalStrands: 3,
  tierCountsJson: { A: 1, B: 1, C: 1, D: 0, unclassified: 0 },
  payloadJson: null,
  generatedAt: new Date("2026-02-01T02:00:00.000Z"),
  createdAt: new Date("2026-02-01T02:00:00.000Z"),
};

function makeGenerateRequest(body: object): Request {
  return new Request("http://localhost/api/admin/reports/monthly/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeListRequest(query: string): Request {
  return new Request(`http://localhost/api/admin/reports/monthly?${query}`);
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: feature on
  mockIsFeatureEnabled.mockReturnValue(true);

  // Default: school admin
  mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);

  // Default: resolveScopeParams returns school A
  mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

  // Default: successful generation
  mockGenerateMonthlyReport.mockResolvedValue({
    reportId: "report_xyz",
    status: "completed",
    month: "2026-01",
    scope: "school",
    scopeId: SCHOOL_A,
    totalStudents: 20,
    totalStrands: 3,
    proficiencyRate: 0.75,
    tierCounts: { A: 1, B: 1, C: 1, D: 0, unclassified: 0 },
  });

  // Default: list returns one row
  mockMonthlyReportFindMany.mockResolvedValue([MOCK_REPORT_ROW]);

  // Default: findUnique returns report for school A
  mockMonthlyReportFindUnique.mockResolvedValue(MOCK_REPORT_ROW);
});

// ─── 1. POST /api/admin/reports/monthly/generate ─────────────────────────────

describe("POST /api/admin/reports/monthly/generate — authentication", () => {
  it("returns 403 when requireRole throws (non-ADMIN user)", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 401 when requireRole throws unauthorized", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );

    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/reports/monthly/generate — scope authorization", () => {
  it("school ADMIN generates report for own school (200)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(200);
    expect(mockGenerateMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("school ADMIN denied for a different school (403 via resolveScopeParams)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockResolveScopeParams.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });

    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_B, month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(403);
    expect(mockGenerateMonthlyReport).not.toHaveBeenCalled();
  });

  it("non-platform admin denied national scope (403 via resolveScopeParams)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockResolveScopeParams.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });

    const req = makeGenerateRequest({ scope: "national", month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(403);
    expect(mockGenerateMonthlyReport).not.toHaveBeenCalled();
  });

  it("platform admin can generate national report (200)", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "national", scopeId: null });

    const req = makeGenerateRequest({ scope: "national", month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(200);
    expect(mockGenerateMonthlyReport).toHaveBeenCalledTimes(1);
  });

  it("county scope returns 400 (not yet supported)", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "county", scopeId: "montserrado" });

    const req = makeGenerateRequest({ scope: "county", scopeId: "montserrado", month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(400);
    expect(mockGenerateMonthlyReport).not.toHaveBeenCalled();
  });

  it("district scope returns 400 (not yet supported)", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "district", scopeId: "district-1" });

    const req = makeGenerateRequest({ scope: "district", scopeId: "district-1", month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(400);
    expect(mockGenerateMonthlyReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/reports/monthly/generate — input validation", () => {
  it("returns 400 when month is missing", async () => {
    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/month/i);
  });

  it("returns 400 for invalid month format (text string)", async () => {
    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "January 2026" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid month format (2-digit year)", async () => {
    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "26-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/admin/reports/monthly/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/json/i);
  });

  it("passes subject to generateMonthlyReport when provided", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeGenerateRequest({
      scope: "school",
      scopeId: SCHOOL_A,
      month: "2026-01",
      subject: "MATH",
    });
    await generateRoute(req as any);

    const callArg = mockGenerateMonthlyReport.mock.calls[0][0];
    expect(callArg.subject).toBe("MATH");
  });

  it("passes null subject when subject is omitted", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });
    await generateRoute(req as any);

    const callArg = mockGenerateMonthlyReport.mock.calls[0][0];
    expect(callArg.subject).toBeNull();
  });
});

describe("POST /api/admin/reports/monthly/generate — idempotency", () => {
  it("calling generate twice returns 200 both times (upsert semantics)", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req1 = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });
    const req2 = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });

    const [res1, res2] = await Promise.all([
      generateRoute(req1 as any),
      generateRoute(req2 as any),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockGenerateMonthlyReport).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/admin/reports/monthly/generate — disabled flag", () => {
  it("returns { disabled: true } body when ENABLE_MONTHLY_REPORTS is off", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });
    mockGenerateMonthlyReport.mockResolvedValue({ disabled: true });

    const req = makeGenerateRequest({ scope: "school", scopeId: SCHOOL_A, month: "2026-01" });
    const res = await generateRoute(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ disabled: true });
  });
});

// ─── 2. GET /api/admin/reports/monthly ───────────────────────────────────────

describe("GET /api/admin/reports/monthly — authentication", () => {
  it("returns 403 when user is not ADMIN", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const req = makeListRequest("scope=school&scopeId=school_aaa");
    const res = await listRoute(req as any);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/reports/monthly — scope authorization", () => {
  it("non-platform admin denied national scope (403 via resolveScopeParams)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockResolveScopeParams.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });

    const req = makeListRequest("scope=national");
    const res = await listRoute(req as any);

    expect(res.status).toBe(403);
    expect(mockMonthlyReportFindMany).not.toHaveBeenCalled();
  });

  it("school admin can list own school reports (200)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeListRequest("scope=school&scopeId=school_aaa");
    const res = await listRoute(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toBeInstanceOf(Array);
  });

  it("county scope returns 400 (not yet supported)", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "county", scopeId: "montserrado" });

    const req = makeListRequest("scope=county&scopeId=montserrado");
    const res = await listRoute(req as any);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/reports/monthly — sentinel remapping", () => {
  it("remaps __NATIONAL__ scopeId to null in list response", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "national", scopeId: null });
    mockMonthlyReportFindMany.mockResolvedValue([
      { ...MOCK_REPORT_ROW, scope: "national", scopeId: "__NATIONAL__", schoolId: null },
    ]);

    const req = makeListRequest("scope=national");
    const res = await listRoute(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports[0].scopeId).toBeNull();
  });

  it("does not expose raw tierCountsJson column name in list response", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeListRequest("scope=school&scopeId=school_aaa");
    const res = await listRoute(req as any);

    const body = await res.json();
    for (const report of body.reports) {
      expect(report).not.toHaveProperty("tierCountsJson");
      expect(report).toHaveProperty("tierCounts");
    }
  });
});

describe("GET /api/admin/reports/monthly — pagination", () => {
  it("defaults to limit=12 when no limit param provided", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeListRequest("scope=school&scopeId=school_aaa");
    await listRoute(req as any);

    const callArg = mockMonthlyReportFindMany.mock.calls[0][0];
    expect(callArg.take).toBe(12);
  });

  it("respects limit param up to max 60", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeListRequest("scope=school&scopeId=school_aaa&limit=30");
    await listRoute(req as any);

    const callArg = mockMonthlyReportFindMany.mock.calls[0][0];
    expect(callArg.take).toBe(30);
  });

  it("clamps limit to max 60 when over-limit requested", async () => {
    mockResolveScopeParams.mockReturnValue({ scope: "school", scopeId: SCHOOL_A });

    const req = makeListRequest("scope=school&scopeId=school_aaa&limit=999");
    await listRoute(req as any);

    const callArg = mockMonthlyReportFindMany.mock.calls[0][0];
    expect(callArg.take).toBe(60);
  });
});

// ─── 3. GET /api/admin/reports/monthly/[id] ──────────────────────────────────

function makeGetRequest(id: string, query = ""): [Request, { params: { id: string } }] {
  const url = `http://localhost/api/admin/reports/monthly/${id}${query ? `?${query}` : ""}`;
  return [new Request(url) as any, { params: { id } }];
}

describe("GET /api/admin/reports/monthly/[id] — authentication", () => {
  it("returns 403 when user is not ADMIN", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(403);
    expect(mockMonthlyReportFindUnique).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/reports/monthly/[id] — access control", () => {
  it("school admin can read their own school's report (200)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({ ...MOCK_REPORT_ROW, schoolId: SCHOOL_A });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(200);
  });

  it("school admin denied access to a different school report (403)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN); // schoolId = SCHOOL_A
    mockMonthlyReportFindUnique.mockResolvedValue({
      ...MOCK_REPORT_ROW,
      schoolId: SCHOOL_B, // different school
      scopeId: SCHOOL_B,
    });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(403);
  });

  it("school admin denied access to national scope report (403)", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({
      ...MOCK_REPORT_ROW,
      scope: "national",
      schoolId: null,
      scopeId: "__NATIONAL__",
    });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(403);
  });

  it("platform admin can read national report (200)", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({
      ...MOCK_REPORT_ROW,
      scope: "national",
      schoolId: null,
      scopeId: "__NATIONAL__",
    });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(200);
  });

  it("platform admin can read any school's report (200)", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({ ...MOCK_REPORT_ROW, schoolId: SCHOOL_B });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(200);
  });
});

describe("GET /api/admin/reports/monthly/[id] — not found and validation", () => {
  it("returns 404 when report does not exist", async () => {
    mockMonthlyReportFindUnique.mockResolvedValue(null);

    const [req, ctx] = makeGetRequest("nonexistent_id");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 for invalid format parameter", async () => {
    mockMonthlyReportFindUnique.mockResolvedValue(MOCK_REPORT_ROW);

    const [req, ctx] = makeGetRequest("report_xyz", "format=xlsx");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/reports/monthly/[id] — PDF stub", () => {
  it("returns 501 for format=pdf when ENABLE_REPORT_PDF_EXPORT is off", async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const [req, ctx] = makeGetRequest("report_xyz", "format=pdf");
    const res = await getRoute(req as any, ctx);

    expect(res.status).toBe(501);
  });

  it("returns 501 for format=pdf even when flag is on (not yet implemented)", async () => {
    mockIsFeatureEnabled.mockReturnValue(true);

    const [req, ctx] = makeGetRequest("report_xyz", "format=pdf");
    const res = await getRoute(req as any, ctx);

    // PDF generation stub always returns 501 ("not yet implemented")
    expect(res.status).toBe(501);
  });
});

describe("GET /api/admin/reports/monthly/[id] — response shape", () => {
  it("remaps __NATIONAL__ scopeId to null for national report", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({
      ...MOCK_REPORT_ROW,
      scope: "national",
      schoolId: null,
      scopeId: "__NATIONAL__",
    });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);
    const body = await res.json();

    expect(body.scopeId).toBeNull();
  });

  it("exposes tierCounts (not raw tierCountsJson) in response", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({
      ...MOCK_REPORT_ROW,
      tierCountsJson: { A: 2, B: 1, C: 0, D: 0, unclassified: 0 },
    });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);
    const body = await res.json();

    expect(body).toHaveProperty("tierCounts");
    expect(body).not.toHaveProperty("tierCountsJson");
  });

  it("exposes payload (not raw payloadJson) in response", async () => {
    mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
    mockMonthlyReportFindUnique.mockResolvedValue({
      ...MOCK_REPORT_ROW,
      payloadJson: { meta: {}, headline: {}, strandBreakdown: [], tierSummary: {} },
    });

    const [req, ctx] = makeGetRequest("report_xyz");
    const res = await getRoute(req as any, ctx);
    const body = await res.json();

    expect(body).toHaveProperty("payload");
    expect(body).not.toHaveProperty("payloadJson");
  });
});
