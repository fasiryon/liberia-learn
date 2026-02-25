/**
 * __tests__/impact.api.access.test.ts — Block 12A
 *
 * Tests for impact dashboard API access control:
 *   - school admin can access school impact
 *   - school admin cannot access national impact
 *   - platform admin can access both school and national
 *   - teacher/guardian denied on both routes
 *   - feature flag OFF → 404
 *   - valid response shape on success
 *   - audit log written on success
 *   - tenant isolation enforced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole       = vi.hoisted(() => vi.fn());
const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockIsImpactEnabled   = vi.hoisted(() => vi.fn());
const mockIsSnapshotsEnabled = vi.hoisted(() => vi.fn());
const mockComputeImpact     = vi.hoisted(() => vi.fn());
const mockComputeNational   = vi.hoisted(() => vi.fn());
const mockLogAudit          = vi.hoisted(() => vi.fn());
const mockAssertPermission  = vi.hoisted(() => vi.fn());
const mockImpactSnapshotCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));
vi.mock("@/lib/serverFlags", () => ({
  isImpactAnalyticsEnabled: mockIsImpactEnabled,
  isImpactSnapshotsEnabled: mockIsSnapshotsEnabled,
}));
vi.mock("@/lib/metrics/impact/impactEngine", () => ({
  computeImpact: mockComputeImpact,
  computeNationalImpact: mockComputeNational,
  isValidPeriod: (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s),
}));
vi.mock("@/lib/audit",       () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: {
    DASHBOARD_SCHOOL_IMPACT: "dashboard:school:impact",
    DASHBOARD_SCHOOL_INTERVENTIONS: "dashboard:school:interventions",
  },
  assertPermission: mockAssertPermission,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    impactSnapshot: { create: mockImpactSnapshotCreate },
  },
}));

import { GET as schoolImpactGET } from "@/app/api/admin/dashboard/school/impact/route";
import { GET as nationalImpactGET } from "@/app/api/admin/dashboard/national/impact/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SCHOOL_ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-aaa",
  isPlatformAdmin: false,
};

const PLATFORM_ADMIN = {
  id: "platform-1",
  role: "ADMIN",
  schoolId: "school-aaa",
  isPlatformAdmin: true,
};

const IMPACT_RESULT = {
  proficiencyRate: 0.65,
  avgMasteryScore: 0.72,
  masteryDelta: 0.08,
  growthDelta: 0.08,
  effectSize: 0.45,
  statisticallyMeaningful: true,
  confidenceLabel: "high",
  sampleSize: 35,
  teacherEffectSignals: [],
};

const NATIONAL_RESULT = {
  proficiencyRate: 0.55,
  avgMasteryScore: 0.62,
  masteryDelta: 0.05,
  growthDelta: 0.05,
  effectSize: 0.3,
  statisticallyMeaningful: false,
  confidenceLabel: "medium",
  sampleSize: 120,
};

function makeReq(params: Record<string, string> = {}, path = "/api/admin/dashboard/school/impact") {
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set("from", params.from ?? "2026-01");
  url.searchParams.set("to",   params.to   ?? "2026-03");
  if (params.schoolId) url.searchParams.set("schoolId", params.schoolId);
  if (params.scope)    url.searchParams.set("scope", params.scope);
  if (params.classId)  url.searchParams.set("classId", params.classId);
  return new Request(url.toString()) as any;
}

function setupDefaults() {
  mockIsImpactEnabled.mockReturnValue(true);
  mockIsSnapshotsEnabled.mockReturnValue(false);
  mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
  mockRequirePlatformAdmin.mockResolvedValue(PLATFORM_ADMIN);
  mockAssertPermission.mockReturnValue(undefined);
  mockComputeImpact.mockResolvedValue(IMPACT_RESULT);
  mockComputeNational.mockResolvedValue(NATIONAL_RESULT);
  mockLogAudit.mockResolvedValue(undefined);
  mockImpactSnapshotCreate.mockResolvedValue({ id: "snap-1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

describe("School impact — feature flag", () => {
  it("returns 404 when ENABLE_IMPACT_ANALYTICS is false", async () => {
    mockIsImpactEnabled.mockReturnValue(false);
    const res = await schoolImpactGET(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("impact_analytics_disabled");
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns 404 when national flag is false", async () => {
    mockIsImpactEnabled.mockReturnValue(false);
    const res = await nationalImpactGET(makeReq({}, "/api/admin/dashboard/national/impact"));
    expect(res.status).toBe(404);
    expect(mockRequirePlatformAdmin).not.toHaveBeenCalled();
  });
});

// ─── School admin access ──────────────────────────────────────────────────────

describe("School impact — school admin access", () => {
  it("returns 200 with impact result for school admin", async () => {
    const res = await schoolImpactGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proficiencyRate).toBe(IMPACT_RESULT.proficiencyRate);
    expect(body.sampleSize).toBe(IMPACT_RESULT.sampleSize);
    expect(body.period).toEqual({ from: "2026-01", to: "2026-03" });
  });

  it("hard-scopes computeImpact to admin's schoolId", async () => {
    await schoolImpactGET(makeReq());
    const [callArgs] = mockComputeImpact.mock.calls[0];
    expect(callArgs.tenantId).toBe(SCHOOL_ADMIN.schoolId);
    expect(callArgs.schoolId).toBe(SCHOOL_ADMIN.schoolId);
  });

  it("writes audit log on success", async () => {
    await schoolImpactGET(makeReq());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SCHOOL_ADMIN.id,
        action: "dashboard.impact.school.viewed",
      })
    );
  });

  it("does not store snapshot when ENABLE_IMPACT_SNAPSHOTS=false", async () => {
    mockIsSnapshotsEnabled.mockReturnValue(false);
    await schoolImpactGET(makeReq());
    expect(mockImpactSnapshotCreate).not.toHaveBeenCalled();
  });

  it("stores snapshot when ENABLE_IMPACT_SNAPSHOTS=true", async () => {
    mockIsSnapshotsEnabled.mockReturnValue(true);
    await schoolImpactGET(makeReq());
    expect(mockImpactSnapshotCreate).toHaveBeenCalledOnce();
  });
});

// ─── School admin cannot access national ─────────────────────────────────────

describe("School impact — school admin cannot access national", () => {
  it("returns 403 when non-platform admin calls national endpoint", async () => {
    mockRequirePlatformAdmin.mockRejectedValue(
      Object.assign(new Error("Forbidden — platform admin required"), { status: 403 })
    );
    const res = await nationalImpactGET(makeReq({}, "/api/admin/dashboard/national/impact"));
    expect(res.status).toBe(403);
    expect(mockComputeNational).not.toHaveBeenCalled();
  });
});

// ─── Platform admin ───────────────────────────────────────────────────────────

describe("Platform admin — can access both endpoints", () => {
  it("platform admin gets 200 on national impact", async () => {
    const res = await nationalImpactGET(makeReq({}, "/api/admin/dashboard/national/impact"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe("national");
    expect(body.sampleSize).toBe(NATIONAL_RESULT.sampleSize);
  });

  it("national result does NOT include teacherEffectSignals", async () => {
    const res = await nationalImpactGET(makeReq({}, "/api/admin/dashboard/national/impact"));
    const body = await res.json();
    // teacherEffectSignals must not be present at national level
    expect(body.teacherEffectSignals).toBeUndefined();
  });

  it("platform admin can query any school via ?schoolId=", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    await schoolImpactGET(makeReq({ schoolId: "other-school-bbb" }));
    const [callArgs] = mockComputeImpact.mock.calls[0];
    expect(callArgs.tenantId).toBe("other-school-bbb");
  });
});

// ─── Teacher/guardian denied ──────────────────────────────────────────────────

describe("School impact — non-admin roles denied", () => {
  it("returns 403 when user is TEACHER", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await schoolImpactGET(makeReq());
    expect(res.status).toBe(403);
    expect(mockComputeImpact).not.toHaveBeenCalled();
  });

  it("returns 403 when user is GUARDIAN", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await schoolImpactGET(makeReq());
    expect(res.status).toBe(403);
    expect(mockComputeImpact).not.toHaveBeenCalled();
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("School impact — input validation", () => {
  it("returns 400 for invalid from format", async () => {
    const res = await schoolImpactGET(makeReq({ from: "Jan-2026" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid to format", async () => {
    const res = await schoolImpactGET(makeReq({ to: "2026/03" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when scope=class but classId missing", async () => {
    const res = await schoolImpactGET(makeReq({ scope: "class" }));
    expect(res.status).toBe(400);
  });

  it("passes classId to computeImpact when scope=class", async () => {
    await schoolImpactGET(makeReq({ scope: "class", classId: "class-xyz" }));
    const [callArgs] = mockComputeImpact.mock.calls[0];
    expect(callArgs.classId).toBe("class-xyz");
  });
});
