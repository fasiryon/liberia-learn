/**
 * __tests__/moe-portal.test.ts — Block 28
 * MOE Access Portal — 5 national oversight routes
 *
 * Guards verified:
 * - Flag off → 404
 * - Non-MOE_OFFICIAL, non-platform-admin → 403
 * - MOE_OFFICIAL → 200
 * - isPlatformAdmin → 200
 * - Responses contain no PII (no names/emails/student IDs in top-level data)
 * - Audit logged on successful access
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

const mockSchoolCount = vi.hoisted(() => vi.fn());
const mockDistrictCount = vi.hoisted(() => vi.fn());
const mockStudentCount = vi.hoisted(() => vi.fn());
const mockScheduledWorkCount = vi.hoisted(() => vi.fn());
const mockInterventionLogCount = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());
const mockStandardFindMany = vi.hoisted(() => vi.fn());
const mockDistrictFindMany = vi.hoisted(() => vi.fn());
const mockInterventionLogFindMany = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/serverFlags", () => ({
  isMoePortalEnabled: mockIsMoePortalEnabled,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { count: mockSchoolCount },
    district: {
      count: mockDistrictCount,
      findMany: mockDistrictFindMany,
    },
    student: { count: mockStudentCount },
    scheduledWork: { count: mockScheduledWorkCount },
    interventionLog: {
      count: mockInterventionLogCount,
      findMany: mockInterventionLogFindMany,
    },
    curriculumContent: { findMany: mockCurriculumContentFindMany },
    standard: { findMany: mockStandardFindMany },
  },
}));

// ─── Route imports (after mocks) ─────────────────────────────────────────────

import { GET as dashboardGET } from "@/app/api/moe/dashboard/route";
import { GET as standardsCoverageGET } from "@/app/api/moe/standards-coverage/route";
import { GET as deliveryComplianceGET } from "@/app/api/moe/delivery-compliance/route";
import { GET as curriculumHealthGET } from "@/app/api/moe/curriculum-health/route";
import { GET as interventionImpactGET } from "@/app/api/moe/intervention-impact/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOE_USER = {
  id: "moe-1",
  role: "MOE_OFFICIAL" as const,
  isPlatformAdmin: false,
  email: "official@moe.gov.lr",
};

const PLATFORM_ADMIN = {
  id: "admin-1",
  role: "ADMIN" as const,
  isPlatformAdmin: true,
  email: "admin@platform.lr",
};

const TEACHER_USER = {
  id: "teacher-1",
  role: "TEACHER" as const,
  isPlatformAdmin: false,
  schoolId: "school-1",
};

async function callGET(handler: () => Promise<Response>): Promise<{ status: number; body: any }> {
  const res = await handler();
  const body = await res.json();
  return { status: res.status, body };
}

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMoePortalEnabled.mockReturnValue(true);
  mockRequireUser.mockResolvedValue(MOE_USER);
  mockLogAudit.mockResolvedValue(undefined);

  // Dashboard defaults
  mockSchoolCount.mockResolvedValue(120);
  mockDistrictCount.mockResolvedValue(15);
  mockStudentCount.mockResolvedValue(50000);
  mockScheduledWorkCount.mockResolvedValueOnce(1000).mockResolvedValueOnce(800);
  mockInterventionLogCount.mockResolvedValue(45);

  // Standards coverage defaults
  mockCurriculumContentFindMany.mockResolvedValue([
    { moeAlignments: { standards: [{ code: "MATH-G1-1" }, { code: "MATH-G1-2" }] }, status: "accepted", subject: "MATH" },
    { moeAlignments: null, status: "accepted", subject: "SCIENCE" },
  ]);
  mockStandardFindMany.mockResolvedValue([
    { code: "MATH-G1-1", subject: "MATH", band: "G1_3" },
    { code: "MATH-G1-2", subject: "MATH", band: "G1_3" },
    { code: "SCI-G4-1", subject: "SCIENCE", band: "G4_6" },
  ]);

  // Delivery compliance defaults
  mockDistrictFindMany.mockResolvedValue([
    {
      id: "dist-1",
      name: "Montserrado",
      region: "Greater Monrovia",
      schools: [
        {
          id: "school-1",
          _count: { users: 120 },
          classes: [
            { scheduledWork: [{ id: "sw-1", isDelivered: true }, { id: "sw-2", isDelivered: false }] },
          ],
        },
      ],
    },
  ]);

  // Curriculum health — reuse curriculumContentFindMany (different route imports)
  // Intervention impact defaults
  mockInterventionLogFindMany.mockResolvedValue([
    { districtId: "dist-1", growthRiskFlag: "HIGH", outcomeDelta: 0.12, outcomeEffectSize: 0.45, generatedAt: new Date() },
    { districtId: "dist-1", growthRiskFlag: "LOW", outcomeDelta: 0.05, outcomeEffectSize: 0.22, generatedAt: new Date() },
    { districtId: null, growthRiskFlag: "HIGH", outcomeDelta: null, outcomeEffectSize: null, generatedAt: new Date() },
  ]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MOE Portal — flag guard", () => {
  it("dashboard returns 404 when flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const { status } = await callGET(dashboardGET);
    expect(status).toBe(404);
  });

  it("standards-coverage returns 404 when flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const { status } = await callGET(standardsCoverageGET);
    expect(status).toBe(404);
  });

  it("delivery-compliance returns 404 when flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const { status } = await callGET(deliveryComplianceGET);
    expect(status).toBe(404);
  });

  it("curriculum-health returns 404 when flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const { status } = await callGET(curriculumHealthGET);
    expect(status).toBe(404);
  });

  it("intervention-impact returns 404 when flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const { status } = await callGET(interventionImpactGET);
    expect(status).toBe(404);
  });
});

describe("MOE Portal — role guard (403 for non-MOE roles)", () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue(TEACHER_USER);
  });

  it("dashboard: TEACHER gets 403", async () => {
    const { status } = await callGET(dashboardGET);
    expect(status).toBe(403);
  });

  it("standards-coverage: TEACHER gets 403", async () => {
    const { status } = await callGET(standardsCoverageGET);
    expect(status).toBe(403);
  });

  it("delivery-compliance: TEACHER gets 403", async () => {
    const { status } = await callGET(deliveryComplianceGET);
    expect(status).toBe(403);
  });

  it("curriculum-health: TEACHER gets 403", async () => {
    const { status } = await callGET(curriculumHealthGET);
    expect(status).toBe(403);
  });

  it("intervention-impact: TEACHER gets 403", async () => {
    const { status } = await callGET(interventionImpactGET);
    expect(status).toBe(403);
  });
});

describe("MOE Portal — MOE_OFFICIAL access (200)", () => {
  it("dashboard returns 200 with aggregate counts", async () => {
    const { status, body } = await callGET(dashboardGET);
    expect(status).toBe(200);
    expect(body.schools).toBe(120);
    expect(body.districts).toBe(15);
    expect(body.students).toBe(50000);
    expect(body.scheduledWork).toBeDefined();
    expect(typeof body.scheduledWork.deliveryRatePct).toBe("number");
    expect(body.interventionsLast30Days).toBe(45);
    expect(body.generatedAt).toBeDefined();
  });

  it("standards-coverage returns 200 with overview and bySubjectBand", async () => {
    const { status, body } = await callGET(standardsCoverageGET);
    expect(status).toBe(200);
    expect(body.overview.totalStandards).toBe(3);
    expect(body.overview.coveredStandards).toBe(2);
    expect(body.overview.coveragePct).toBe(67);
    expect(Array.isArray(body.bySubjectBand)).toBe(true);
  });

  it("delivery-compliance returns 200 with national and byDistrict", async () => {
    const { status, body } = await callGET(deliveryComplianceGET);
    expect(status).toBe(200);
    expect(body.national.scheduledWorkTotal).toBe(2);
    expect(body.national.scheduledWorkDelivered).toBe(1);
    expect(body.national.compliancePct).toBe(50);
    expect(body.byDistrict).toHaveLength(1);
    expect(body.byDistrict[0].districtName).toBe("Montserrado");
  });

  it("curriculum-health returns 200 with alignment breakdown", async () => {
    const { status, body } = await callGET(curriculumHealthGET);
    expect(status).toBe(200);
    expect(body.national.totalContent).toBe(2);
    expect(body.national.alignedContent).toBe(1);
    expect(body.national.alignmentPct).toBe(50);
    expect(Array.isArray(body.bySubject)).toBe(true);
  });

  it("intervention-impact returns 200 with national and byDistrict", async () => {
    const { status, body } = await callGET(interventionImpactGET);
    expect(status).toBe(200);
    expect(body.national.totalInterventions).toBe(3);
    expect(typeof body.national.avgOutcomeDelta).toBe("number");
    expect(Array.isArray(body.byDistrict)).toBe(true);
  });
});

describe("MOE Portal — isPlatformAdmin access (200)", () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
  });

  it("dashboard: isPlatformAdmin gets 200", async () => {
    const { status } = await callGET(dashboardGET);
    expect(status).toBe(200);
  });

  it("standards-coverage: isPlatformAdmin gets 200", async () => {
    const { status } = await callGET(standardsCoverageGET);
    expect(status).toBe(200);
  });

  it("delivery-compliance: isPlatformAdmin gets 200", async () => {
    const { status } = await callGET(deliveryComplianceGET);
    expect(status).toBe(200);
  });

  it("curriculum-health: isPlatformAdmin gets 200", async () => {
    const { status } = await callGET(curriculumHealthGET);
    expect(status).toBe(200);
  });

  it("intervention-impact: isPlatformAdmin gets 200", async () => {
    const { status } = await callGET(interventionImpactGET);
    expect(status).toBe(200);
  });
});

describe("MOE Portal — no PII in responses", () => {
  it("dashboard body has no email, name, or student IDs", async () => {
    const { body } = await callGET(dashboardGET);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("email");
    expect(bodyStr).not.toContain("student-");
    expect(bodyStr).not.toContain("teacher-");
  });

  it("delivery-compliance body has no schoolId leakage in names", async () => {
    const { body } = await callGET(deliveryComplianceGET);
    // byDistrict has districtId and districtName, no individual school names
    for (const d of body.byDistrict) {
      expect(d).not.toHaveProperty("schools");
    }
  });

  it("intervention-impact body has no individual school-level IDs", async () => {
    const { body } = await callGET(interventionImpactGET);
    for (const d of body.byDistrict) {
      expect(d).not.toHaveProperty("schoolId");
      expect(d).not.toHaveProperty("tenantId");
    }
  });
});

describe("MOE Portal — audit logging", () => {
  it("dashboard logs MOE_DASHBOARD_VIEW on success", async () => {
    await callGET(dashboardGET);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_DASHBOARD_VIEW", userId: MOE_USER.id })
    );
  });

  it("standards-coverage logs MOE_STANDARDS_COVERAGE_VIEW on success", async () => {
    await callGET(standardsCoverageGET);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_STANDARDS_COVERAGE_VIEW", userId: MOE_USER.id })
    );
  });

  it("delivery-compliance logs MOE_DELIVERY_COMPLIANCE_VIEW on success", async () => {
    await callGET(deliveryComplianceGET);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_DELIVERY_COMPLIANCE_VIEW", userId: MOE_USER.id })
    );
  });

  it("curriculum-health logs MOE_CURRICULUM_HEALTH_VIEW on success", async () => {
    await callGET(curriculumHealthGET);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_CURRICULUM_HEALTH_VIEW", userId: MOE_USER.id })
    );
  });

  it("intervention-impact logs MOE_INTERVENTION_IMPACT_VIEW on success", async () => {
    await callGET(interventionImpactGET);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_INTERVENTION_IMPACT_VIEW", userId: MOE_USER.id })
    );
  });

  it("audit is NOT logged when 403 returned", async () => {
    mockRequireUser.mockResolvedValue(TEACHER_USER);
    await callGET(dashboardGET);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
