/**
 * __tests__/csv-streaming.test.ts
 *
 * Gap 4: Verifies that the audit-log CSV export streams rows in chunks rather
 * than loading everything into memory, and that the monthly report uses
 * groupBy aggregation instead of findMany for audit event counts.
 *
 * Tests confirm:
 *  1. CSV response is a stream (ReadableStream body) — not a plain string
 *  2. Correct CSV header is included in the first chunk
 *  3. Multiple findMany calls are made for datasets > CHUNK_SIZE (500)
 *  4. Total rows are capped at CSV_MAX_ROWS (5 000)
 *  5. buildMonthlyReportExport uses groupBy (never calls auditLog.findMany)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockAuditFindMany = vi.hoisted(() => vi.fn());
const mockAuditCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockAuditGroupBy = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockSchoolCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockUserCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockSmsCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockExportFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockExportCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "export-1" }));
const mockTrainingCount = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockMetricEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockIsGovAuditEnabled = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockIsCircuitBreaker = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/permissions", () => ({
  assertPermission: mockAssertPermission,
  PERMISSIONS: {
    COMPLIANCE_AUDIT_READ: "COMPLIANCE_AUDIT_READ",
    COMPLIANCE_AUDIT_EXPORT: "COMPLIANCE_AUDIT_EXPORT",
  },
}));
vi.mock("@/lib/serverFlags", () => ({
  isGovAuditSearchEnabled: mockIsGovAuditEnabled,
  isGovCircuitBreakerTripped: mockIsCircuitBreaker,
  isGovExportsEnabled: vi.fn().mockReturnValue(true),
  isGovNationalExportEnabled: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockMetricEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: mockAuditFindMany,
      count: mockAuditCount,
      groupBy: mockAuditGroupBy,
    },
    school: { findMany: mockSchoolFindMany, count: mockSchoolCount },
    user: { count: mockUserCount },
    sMSDeliveryLog: { count: mockSmsCount },
    exportRecord: { findMany: mockExportFindMany, create: mockExportCreate },
    trainingProgress: { count: mockTrainingCount },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

function buildRow(i: number) {
  return {
    id: `log-${i}`,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    action: "lesson_view",
    userId: "user-1",
    resourceType: "scheduledWork",
    resourceId: `sw-${i}`,
    schoolId: "school-1",
    traceId: null,
    ipAddress: null,
  };
}

async function drainStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Gap 4: streaming CSV export — audit-log route", () => {
  beforeEach(() => {
    vi.resetAllMocks(); // also clears once-queue, preventing cross-test mock leakage
    mockRequireRole.mockResolvedValue(ADMIN_USER);
    mockAssertPermission.mockReturnValue(undefined);
    mockIsGovAuditEnabled.mockReturnValue(true);
    mockIsCircuitBreaker.mockReturnValue(false);
    mockLogAudit.mockResolvedValue(undefined);
    mockAuditCount.mockResolvedValue(0);
    mockAuditGroupBy.mockResolvedValue([]);
  });

  async function callGet(params: Record<string, string> = {}) {
    const { GET } = await import("@/app/api/admin/compliance/audit-log/route");
    const url = new URL("http://localhost/api/admin/compliance/audit-log");
    url.searchParams.set("format", "csv");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return GET(new NextRequest(url.toString()));
  }

  it("response body is a ReadableStream (streaming — not a plain string)", async () => {
    mockAuditFindMany.mockResolvedValueOnce([]);
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(ReadableStream);
    await drainStream(res.body as ReadableStream<Uint8Array>); // drain to prevent cross-test leakage
  });

  it("first chunk includes CSV column header", async () => {
    mockAuditFindMany.mockResolvedValueOnce([buildRow(1)]).mockResolvedValueOnce([]);
    const res = await callGet();
    const text = await drainStream(res.body as ReadableStream<Uint8Array>);
    expect(text).toContain("ID,Created At,Action,User ID");
  });

  it("response rows include audit log data", async () => {
    mockAuditFindMany.mockResolvedValueOnce([buildRow(1)]).mockResolvedValueOnce([]);
    const res = await callGet();
    const text = await drainStream(res.body as ReadableStream<Uint8Array>);
    expect(text).toContain("log-1");
    expect(text).toContain("lesson_view");
  });

  it("makes multiple findMany calls when first chunk is exactly CHUNK_SIZE (pagination)", async () => {
    // First call returns 500 rows, second returns 0 (signals end of data)
    const firstChunk = Array.from({ length: 500 }, (_, i) => buildRow(i));
    mockAuditFindMany
      .mockResolvedValueOnce(firstChunk)
      .mockResolvedValueOnce([]);
    const res = await callGet();
    await drainStream(res.body as ReadableStream<Uint8Array>);
    expect(mockAuditFindMany).toHaveBeenCalledTimes(2);
  });

  it("second DB fetch uses cursor from last row id of previous chunk", async () => {
    const firstChunk = Array.from({ length: 500 }, (_, i) => buildRow(i));
    mockAuditFindMany
      .mockResolvedValueOnce(firstChunk)
      .mockResolvedValueOnce([]);
    const res = await callGet();
    await drainStream(res.body as ReadableStream<Uint8Array>);
    // Find the call that included a cursor (the second DB fetch)
    const cursorCall = mockAuditFindMany.mock.calls.find(
      (call: any[]) => call[0]?.cursor !== undefined
    );
    expect(cursorCall).toBeDefined();
    expect(cursorCall[0].cursor).toEqual({ id: "log-499" });
    expect(cursorCall[0].skip).toBe(1);
  });

  it("stops after CSV_MAX_ROWS even if more data exists", async () => {
    // Simulate unlimited 500-row chunks — should stop after exactly 10 (5 000 rows)
    const chunk = Array.from({ length: 500 }, (_, i) => buildRow(i));
    mockAuditFindMany.mockResolvedValue(chunk);
    const res = await callGet();
    await drainStream(res.body as ReadableStream<Uint8Array>); // drain all chunks
    // 5 000 / 500 = 10 calls; chunk.length (500) equals min(500, remaining) on
    // the 10th call — loop exits via fetched >= CSV_MAX_ROWS condition
    expect(mockAuditFindMany).toHaveBeenCalledTimes(10);
  });

  it("Content-Type is text/csv", async () => {
    mockAuditFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await callGet();
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("Content-Disposition is attachment with .csv filename", async () => {
    mockAuditFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await callGet();
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain(".csv");
  });
});

// ─── Monthly report groupBy ───────────────────────────────────────────────────

describe("Gap 4: monthly report uses groupBy (no OOM from findMany)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-setup mocks cleared by resetAllMocks
    mockAuditGroupBy.mockResolvedValue([
      { action: "lesson_view", _count: { action: 120 } },
      { action: "homework_submit", _count: { action: 45 } },
    ]);
    mockUserCount.mockResolvedValue(0);
    mockSchoolCount.mockResolvedValue(1);
    mockAuditCount.mockResolvedValue(0);
    mockSmsCount.mockResolvedValue(0);
    mockExportFindMany.mockResolvedValue([]);
    mockExportCreate.mockResolvedValue({ id: "export-1" });
    mockTrainingCount.mockResolvedValue(0);
    mockLogAudit.mockResolvedValue(undefined);
    mockMetricEvent.mockResolvedValue(undefined);
  });

  it("buildMonthlyReportExport calls groupBy — NOT findMany — for audit event counts", async () => {
    const { buildMonthlyReportExport } = await import("@/lib/exports/governanceExport");
    await buildMonthlyReportExport({
      userId: "admin-1",
      schoolId: "school-1",
      yearMonth: "2026-03",
      format: "json",
      traceId: "trace-1",
    });
    expect(mockAuditGroupBy).toHaveBeenCalledTimes(1);
    // auditLog.findMany must NOT be called for the monthly report aggregation
    expect(mockAuditFindMany).not.toHaveBeenCalled();
  });

  it("byAction totals are derived from groupBy result", async () => {
    const { buildMonthlyReportExport } = await import("@/lib/exports/governanceExport");
    const result = await buildMonthlyReportExport({
      userId: "admin-1",
      schoolId: "school-1",
      yearMonth: "2026-03",
      format: "json",
      traceId: "trace-1",
    });
    const data = JSON.parse(result.body);
    expect(data.auditEvents.byAction["lesson_view"]).toBe(120);
    expect(data.auditEvents.byAction["homework_submit"]).toBe(45);
    expect(data.auditEvents.totalAuditEntries).toBe(165);
  });
});
