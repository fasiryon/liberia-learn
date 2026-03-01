import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());

const mockIsDeliveryComplianceReportingEnabled = vi.hoisted(() => vi.fn());
const mockIsAbBlockSchedulingEnabled = vi.hoisted(() => vi.fn());
const mockIsAssignmentLessonLinkageEnabled = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled = vi.hoisted(() => vi.fn());

const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockLabSessionCount = vi.hoisted(() => vi.fn());
const mockAssignmentCount = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionCount = vi.hoisted(() => vi.fn());
const mockEnrollmentGroupBy = vi.hoisted(() => vi.fn());
const mockLabSessionCountWeek = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isDeliveryComplianceReportingEnabled: mockIsDeliveryComplianceReportingEnabled,
    isAbBlockSchedulingEnabled: mockIsAbBlockSchedulingEnabled,
    isAssignmentLessonLinkageEnabled: mockIsAssignmentLessonLinkageEnabled,
    isVirtualLabsEnabled: mockIsVirtualLabsEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    class: {
      findMany: mockClassFindMany,
    },
    scheduledWork: {
      findMany: mockScheduledWorkFindMany,
    },
    labSession: {
      count: mockLabSessionCount,
    },
    assignment: {
      count: mockAssignmentCount,
    },
    assignmentSuggestion: {
      count: mockAssignmentSuggestionCount,
    },
    enrollment: {
      groupBy: mockEnrollmentGroupBy,
    },
  },
}));

import { GET as complianceGet } from "@/app/api/admin/compliance/delivery-report/route";
import { GET as scheduleGet } from "@/app/api/teacher/schedule/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: "admin-1",
  schoolId: "school-1",
  role: "ADMIN",
  isPlatformAdmin: false,
};

const PLATFORM_ADMIN_USER = {
  id: "platform-admin-1",
  schoolId: null,
  role: "ADMIN",
  isPlatformAdmin: true,
};

const TEACHER_USER = {
  id: "teacher-1",
  schoolId: "school-1",
  role: "TEACHER",
};

// Delivered lessons include moeAlignments; undelivered do not contribute to covered codes
const SCHEDULE_DELIVERED = {
  id: "sw-1",
  classId: "class-1",
  isDelivered: true,
  scheduledDate: new Date("2026-03-03"),
  content: {
    moeAlignments: [{ code: "MATH-G6-ALG-01" }, { code: "MATH-G6-ALG-02" }],
    contentId: "content-1",
    subject: "MATH",
    payload: { title: "Algebra Basics" },
    grade: 6,
    deliveryProfile: null,
  },
  progress: [],
  classFormat: "standard",
  deliveredAt: new Date("2026-03-03T09:00:00Z"),
  completionRate: 88,
  sessionPairId: null,
  status: "confirmed",
};

const SCHEDULE_UNDELIVERED = {
  id: "sw-2",
  classId: "class-1",
  isDelivered: false,
  scheduledDate: new Date("2026-03-04"),
  content: {
    moeAlignments: [{ code: "SCI-G8-LIF-01" }],
    contentId: "content-2",
    subject: "SCIENCE",
    payload: { title: "Cell Division" },
    grade: 8,
    deliveryProfile: null,
  },
  progress: [],
  classFormat: "block_a",
  deliveredAt: null,
  completionRate: null,
  sessionPairId: null,
  status: "confirmed",
};

function makeGetRequest(url: string) {
  return new Request(url) as any;
}

// ─── Tests: GET /api/admin/compliance/delivery-report ────────────────────────

describe("GET /api/admin/compliance/delivery-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_USER);
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(true);
    mockClassFindMany.mockResolvedValue([{ id: "class-1" }]);
    mockScheduledWorkFindMany.mockResolvedValue([SCHEDULE_DELIVERED, SCHEDULE_UNDELIVERED]);
    mockLabSessionCount.mockResolvedValue(3);
    mockAssignmentCount.mockResolvedValue(1);
  });

  it("returns 404 when ENABLE_DELIVERY_COMPLIANCE_REPORTING flag is OFF", async () => {
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(false);

    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report?schoolId=school-1")
    );

    expect(res.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns 403 when non-platform-admin requests a different school's data", async () => {
    const res = await complianceGet(
      makeGetRequest(
        "http://localhost/api/admin/compliance/delivery-report?schoolId=school-OTHER"
      )
    );

    expect(res.status).toBe(403);
  });

  it("uses own schoolId when non-platform-admin omits schoolId param", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    expect(res.status).toBe(200);
    const findManyArgs = mockClassFindMany.mock.calls[0][0];
    expect(findManyArgs.where.schoolId).toBe("school-1");
  });

  it("platform-admin requires schoolId param", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN_USER);

    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    expect(res.status).toBe(400);
  });

  it("platform-admin can query any school by schoolId param", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN_USER);

    const res = await complianceGet(
      makeGetRequest(
        "http://localhost/api/admin/compliance/delivery-report?schoolId=school-99"
      )
    );

    expect(res.status).toBe(200);
    const findManyArgs = mockClassFindMany.mock.calls[0][0];
    expect(findManyArgs.where.schoolId).toBe("school-99");
  });

  it("returns plannedLessons count", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    expect(json.plannedLessons).toBe(2);
  });

  it("returns deliveredLessons count", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    expect(json.deliveredLessons).toBe(1);
  });

  it("returns deliveryRate as a rounded decimal", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    expect(json.deliveryRate).toBe(0.5);
  });

  it("returns moeStandardsCovered from delivered lessons only", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    // Only delivered lesson codes: MATH-G6-ALG-01 and MATH-G6-ALG-02
    // SCI-G8-LIF-01 is from the undelivered lesson and should be excluded
    expect(json.moeStandardsCovered).toContain("MATH-G6-ALG-01");
    expect(json.moeStandardsCovered).toContain("MATH-G6-ALG-02");
    expect(json.moeStandardsCovered).not.toContain("SCI-G8-LIF-01");
  });

  it("returns labSessionsCompleted count", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    expect(json.labSessionsCompleted).toBe(3);
  });

  it("returns assignmentsLinked count", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    expect(json.assignmentsLinked).toBe(1);
  });

  it("response contains no student identifiers (privacy check)", async () => {
    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    const bodyStr = JSON.stringify(json);
    // Response must not contain student IDs or names at the top level
    expect(bodyStr).not.toContain("studentId");
    expect(bodyStr).not.toContain("studentName");
    expect(bodyStr).not.toContain("userId");
  });

  it("returns zeros when school has no classes", async () => {
    mockClassFindMany.mockResolvedValue([]);

    const res = await complianceGet(
      makeGetRequest("http://localhost/api/admin/compliance/delivery-report")
    );

    const json = await res.json();
    expect(json.plannedLessons).toBe(0);
    expect(json.deliveredLessons).toBe(0);
    expect(json.deliveryRate).toBe(0);
    expect(json.moeStandardsCovered).toEqual([]);
    expect(json.labSessionsCompleted).toBe(0);
    expect(json.assignmentsLinked).toBe(0);
  });
});

// ─── Tests: Enhanced GET /api/teacher/schedule with compliance flag ────────────

describe("GET /api/teacher/schedule — enhanced compliance fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(true);
    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(false);

    mockClassFindMany.mockResolvedValue([{ id: "class-1", name: "Grade 6 Math" }]);
    mockScheduledWorkFindMany.mockResolvedValue([SCHEDULE_DELIVERED, SCHEDULE_UNDELIVERED]);
    mockEnrollmentGroupBy.mockResolvedValue([{ classId: "class-1", _count: 25 }]);
    mockAssignmentSuggestionCount.mockResolvedValue(2);
    mockLabSessionCount.mockResolvedValue(1);
  });

  it("returns base schedule response when flag is OFF", async () => {
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(false);

    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    // Base fields
    expect(json.items).toBeDefined();
    expect(json.classes).toBeDefined();
    expect(json.weekStart).toBeDefined();
    // Enhanced fields must NOT appear when flag is OFF
    expect(json.moeStandardsCoverage).toBeUndefined();
    expect(json.plannedVsDelivered).toBeUndefined();
    expect(json.pacingStatus).toBeUndefined();
    expect(json.pendingAssignmentSuggestions).toBeUndefined();
    expect(json.labSessionsThisWeek).toBeUndefined();
    expect(json.unitProgress).toBeUndefined();
  });

  it("returns enhanced fields when flag is ON", async () => {
    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    // Enhanced compliance fields
    expect(json).toHaveProperty("moeStandardsCoverage");
    expect(json).toHaveProperty("pacingStatus");
    expect(json).toHaveProperty("plannedVsDelivered");
    expect(json).toHaveProperty("pendingAssignmentSuggestions");
    expect(json).toHaveProperty("labSessionsThisWeek");
    expect(json).toHaveProperty("unitProgress");
    expect(json).toHaveProperty("unscheduledStandards");
    expect(json).toHaveProperty("pendingLabSessions");
  });

  it("moeStandardsCoverage includes codes from ALL scheduled lessons (planned)", async () => {
    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    const json = await res.json();
    // The GET schedule route includes codes from all (delivered + undelivered) content
    const coverage: string[] = json.moeStandardsCoverage;
    expect(coverage).toContain("MATH-G6-ALG-01");
    expect(coverage).toContain("MATH-G6-ALG-02");
    expect(coverage).toContain("SCI-G8-LIF-01");
  });

  it("plannedVsDelivered reflects correct counts", async () => {
    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    const json = await res.json();
    expect(json.plannedVsDelivered.planned).toBe(2);
    expect(json.plannedVsDelivered.delivered).toBe(1);
  });

  it("pendingAssignmentSuggestions returns count from DB", async () => {
    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    const json = await res.json();
    expect(json.pendingAssignmentSuggestions).toBe(2);
  });

  it("each schedule item includes Part 2 delivery tracking fields", async () => {
    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    const json = await res.json();
    const deliveredItem = json.items.find((i: any) => i.id === "sw-1");
    expect(deliveredItem).toBeDefined();
    expect(deliveredItem).toHaveProperty("isDelivered");
    expect(deliveredItem).toHaveProperty("deliveredAt");
    expect(deliveredItem).toHaveProperty("completionRate");
    expect(deliveredItem).toHaveProperty("classFormat");
    expect(deliveredItem).toHaveProperty("sessionPairId");
    expect(deliveredItem).toHaveProperty("status");
  });

  it("pacingStatus is on_track when delivery rate >= 90%", async () => {
    // 9 delivered, 1 undelivered = 90%
    const nineDelivered = Array.from({ length: 9 }, (_, i) => ({
      ...SCHEDULE_DELIVERED,
      id: `sw-delivered-${i}`,
    }));
    mockScheduledWorkFindMany.mockResolvedValue([...nineDelivered, SCHEDULE_UNDELIVERED]);

    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    const json = await res.json();
    expect(json.pacingStatus).toBe("on_track");
  });

  it("pacingStatus is behind when delivery rate < 90%", async () => {
    // 1 delivered, 1 undelivered = 50% delivery rate
    const res = await scheduleGet(
      makeGetRequest("http://localhost/api/teacher/schedule")
    );

    const json = await res.json();
    expect(json.pacingStatus).toBe("behind");
  });
});
