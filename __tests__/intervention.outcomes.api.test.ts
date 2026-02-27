/**
 * __tests__/intervention.outcomes.api.test.ts — Block 17
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockIsInterventionOutcomesEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockInterventionLogFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: {
    VIEW_SCHOOL_DASHBOARD: "view:school:dashboard",
  },
  assertPermission: mockAssertPermission,
}));
vi.mock("@/lib/serverFlags", () => ({
  isInterventionOutcomesEnabled: mockIsInterventionOutcomesEnabled,
}));
vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));
vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    interventionLog: {
      findMany: mockInterventionLogFindMany,
    },
  },
}));

import { GET } from "@/app/api/admin/dashboard/school/intervention-outcomes/route";

const SCHOOL_ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const PLATFORM_ADMIN = {
  id: "platform-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: true,
};

function makeReq(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

function setupDefaults() {
  mockIsInterventionOutcomesEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
  mockAssertPermission.mockReturnValue(undefined);
  mockInterventionLogFindMany.mockResolvedValue([
    { outcomeCheckedAt: new Date(), outcomeDelta: 0.1, outcomeEffectSize: 0.4 },
    { outcomeCheckedAt: null, outcomeDelta: null, outcomeEffectSize: null },
  ]);
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

describe("intervention outcomes API access", () => {
  it("school admin can access own school", async () => {
    const res = await GET(makeReq("/api/admin/dashboard/school/intervention-outcomes"));
    expect(res.status).toBe(200);
  });

  it("school admin cannot access other school", async () => {
    const res = await GET(
      makeReq("/api/admin/dashboard/school/intervention-outcomes", { schoolId: "other-school" })
    );
    expect(res.status).toBe(403);
  });

  it("platform admin can access any school", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    const res = await GET(
      makeReq("/api/admin/dashboard/school/intervention-outcomes", { schoolId: "other-school" })
    );
    expect(res.status).toBe(200);
    const [call] = mockInterventionLogFindMany.mock.calls;
    expect(call[0].where.schoolId).toBe("other-school");
  });

  it("returns 404 when flag disabled", async () => {
    mockIsInterventionOutcomesEnabled.mockReturnValue(false);
    const res = await GET(makeReq("/api/admin/dashboard/school/intervention-outcomes"));
    expect(res.status).toBe(404);
  });

  it("response does not include teacher attribution fields", async () => {
    const res = await GET(makeReq("/api/admin/dashboard/school/intervention-outcomes"));
    const body = await res.json();
    expect(body.teacherEffectSignals).toBeUndefined();
    expect(body.teacherIdHash).toBeUndefined();
    expect(body).not.toHaveProperty("teacherId");
  });
});

