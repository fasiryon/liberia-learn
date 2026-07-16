import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrisma,
  mockEnqueueEscalation,
  mockAggregateWaecForStudents,
  mockGetDeliveryComplianceByDistrict,
  mockGetDeliveryComplianceForSchool,
} = vi.hoisted(() => ({
  mockPrisma: {
    student: { findMany: vi.fn() },
    derivedStudentProgress: { findMany: vi.fn() },
    reportDraft: { findFirst: vi.fn(), create: vi.fn() },
  },
  mockEnqueueEscalation: vi.fn(),
  mockAggregateWaecForStudents: vi.fn(),
  mockGetDeliveryComplianceByDistrict: vi.fn(),
  mockGetDeliveryComplianceForSchool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));
vi.mock("@/lib/waec/aggregate", () => ({ aggregateWaecForStudents: mockAggregateWaecForStudents }));
vi.mock("@/lib/moe/deliveryCompliance", () => ({
  getDeliveryComplianceByDistrict: mockGetDeliveryComplianceByDistrict,
  getDeliveryComplianceForSchool: mockGetDeliveryComplianceForSchool,
}));

import {
  moereportGetScopeDataTool,
  moereportGetPriorReportTool,
  moereportDetectNotableChangesTool,
  moereportSaveDraftReportTool,
  moereportFlagForHumanReviewTool,
  type ScopeData,
} from "@/lib/agents/tools/moereport.tools";

const CTX = { agentName: "moe-narrative-report", userId: null, userRole: "system" as const, traceId: "trace-1" };

function resetAll() {
  Object.values(mockPrisma).forEach((delegate) =>
    Object.values(delegate).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  );
  mockEnqueueEscalation.mockReset();
  mockAggregateWaecForStudents.mockReset();
  mockGetDeliveryComplianceByDistrict.mockReset();
  mockGetDeliveryComplianceForSchool.mockReset();

  mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  mockAggregateWaecForStudents.mockResolvedValue([]);
  mockGetDeliveryComplianceByDistrict.mockResolvedValue({
    national: { scheduledWorkTotal: 100, scheduledWorkDelivered: 80, compliancePct: 80 },
    byDistrict: [
      { districtId: "d1", districtName: "Montserrado", region: "Central", schoolCount: 3, studentCount: 300, scheduledWorkTotal: 60, scheduledWorkDelivered: 50, compliancePct: 83.33 },
    ],
  });
  mockGetDeliveryComplianceForSchool.mockResolvedValue({
    schoolId: "school-1",
    scheduledWorkTotal: 10,
    scheduledWorkDelivered: 9,
    compliancePct: 90,
  });
  mockPrisma.student.findMany.mockResolvedValue([]);
  mockPrisma.derivedStudentProgress.findMany.mockResolvedValue([]);
  mockPrisma.reportDraft.create.mockResolvedValue({ id: "report-1" });
}

function makeScopeData(overrides: Partial<ScopeData> = {}): ScopeData {
  return {
    scope: "national",
    scopeId: null,
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    enrollment: 1000,
    activeStudents: 500,
    waecReadiness: {
      studentCount: 200,
      subjects: [
        { subjectId: "physics", name: "Physics", assessedStudents: 100, avgReadiness: 60, atRisk: 20, onTrack: 30 },
      ],
    },
    deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 80, compliancePct: 80 },
    ...overrides,
  };
}

describe("moereport.getScopeData", () => {
  beforeEach(resetAll);

  it("aggregates national scope with no scopeId filter", async () => {
    mockPrisma.student.findMany.mockResolvedValue([
      { id: "s1", currentGrade: 10 },
      { id: "s2", currentGrade: 5 },
    ]);

    const result = await moereportGetScopeDataTool.handler(
      { scope: "national", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );

    expect(mockPrisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(result.enrollment).toBe(2);
    expect(result.deliveryCompliance.compliancePct).toBe(80);
  });

  it("scopes to a district via the student.user.school.districtId join", async () => {
    mockPrisma.student.findMany.mockResolvedValue([{ id: "s1", currentGrade: 10 }]);

    await moereportGetScopeDataTool.handler(
      { scope: "district", scopeId: "d1", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );

    expect(mockPrisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { school: { districtId: "d1" } } } })
    );
    expect(mockGetDeliveryComplianceByDistrict).toHaveBeenCalled();
  });

  it("scopes to a school via the student.user.schoolId filter", async () => {
    mockPrisma.student.findMany.mockResolvedValue([{ id: "s1", currentGrade: 11 }]);

    const result = await moereportGetScopeDataTool.handler(
      { scope: "school", scopeId: "school-1", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );

    expect(mockPrisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { schoolId: "school-1" } } })
    );
    expect(mockGetDeliveryComplianceForSchool).toHaveBeenCalledWith("school-1");
    expect(result.deliveryCompliance.compliancePct).toBe(90);
  });

  it("throws when scopeId is missing for district scope", async () => {
    await expect(
      moereportGetScopeDataTool.handler({ scope: "district", periodStart: "2026-06-01", periodEnd: "2026-06-30" }, CTX)
    ).rejects.toThrow(/scopeId is required/);
  });

  it("throws when scopeId is missing for school scope", async () => {
    await expect(
      moereportGetScopeDataTool.handler({ scope: "school", periodStart: "2026-06-01", periodEnd: "2026-06-30" }, CTX)
    ).rejects.toThrow(/scopeId is required/);
  });

  it("only passes grade-9+ student ids to the WAEC aggregator, not the full enrollment", async () => {
    mockPrisma.student.findMany.mockResolvedValue([
      { id: "s1", currentGrade: 10 },
      { id: "s2", currentGrade: 5 },
      { id: "s3", currentGrade: 9 },
    ]);

    const result = await moereportGetScopeDataTool.handler(
      { scope: "national", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );

    expect(mockAggregateWaecForStudents).toHaveBeenCalledWith(["s1", "s3"]);
    expect(result.waecReadiness.studentCount).toBe(2);
  });

  it("counts active students via derivedStudentProgress within the period window, distinct per student", async () => {
    mockPrisma.student.findMany.mockResolvedValue([{ id: "s1", currentGrade: 10 }, { id: "s2", currentGrade: 10 }]);
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValue([{ studentId: "s1" }]);

    const result = await moereportGetScopeDataTool.handler(
      { scope: "national", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );

    expect(mockPrisma.derivedStudentProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ["studentId"],
        where: expect.objectContaining({ studentId: { in: ["s1", "s2"] } }),
      })
    );
    expect(result.activeStudents).toBe(1);
  });

  it("skips the derivedStudentProgress query entirely when there are no students in scope", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);

    const result = await moereportGetScopeDataTool.handler(
      { scope: "school", scopeId: "empty-school", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );

    expect(mockPrisma.derivedStudentProgress.findMany).not.toHaveBeenCalled();
    expect(result.activeStudents).toBe(0);
    expect(result.enrollment).toBe(0);
  });

  it("falls back to zeroed delivery compliance for a district with no matching row", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    const result = await moereportGetScopeDataTool.handler(
      { scope: "district", scopeId: "unknown-district", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
      CTX
    );
    expect(result.deliveryCompliance).toEqual({ scheduledWorkTotal: 0, scheduledWorkDelivered: 0, compliancePct: null });
  });
});

describe("moereport.getPriorReport", () => {
  beforeEach(resetAll);

  it("returns null when no prior report exists for this scope/periodType", async () => {
    mockPrisma.reportDraft.findFirst.mockResolvedValue(null);
    const result = await moereportGetPriorReportTool.handler({ scope: "national", periodType: "monthly" }, CTX);
    expect(result).toBeNull();
  });

  it("returns the most recent report, parsing the stored snapshot back out", async () => {
    const snapshot = makeScopeData();
    mockPrisma.reportDraft.findFirst.mockResolvedValue({
      id: "report-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      narrativeText: "Last month's report.",
      dataSnapshot: snapshot,
    });

    const result = await moereportGetPriorReportTool.handler({ scope: "national", periodType: "monthly" }, CTX);

    expect(result?.reportId).toBe("report-1");
    expect(result?.narrativeText).toBe("Last month's report.");
    expect(mockPrisma.reportDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scope: "national", scopeId: null, periodType: "monthly" },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("passes a real scopeId through for district/school queries", async () => {
    mockPrisma.reportDraft.findFirst.mockResolvedValue(null);
    await moereportGetPriorReportTool.handler({ scope: "school", scopeId: "school-1", periodType: "quarterly" }, CTX);
    expect(mockPrisma.reportDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scope: "school", scopeId: "school-1", periodType: "quarterly" } })
    );
  });
});

describe("moereport.detectNotableChanges (deterministic thresholds)", () => {
  beforeEach(resetAll);

  it("returns no changes when there is no prior report to diff against", async () => {
    const result = await moereportDetectNotableChangesTool.handler(
      { currentData: makeScopeData(), priorData: null },
      CTX
    );
    expect(result.changes).toEqual([]);
  });

  it("reports no change for an identical metric across periods", async () => {
    const data = makeScopeData();
    const result = await moereportDetectNotableChangesTool.handler({ currentData: data, priorData: data }, CTX);
    expect(result.changes).toEqual([]);
  });

  it.each([
    [2, "LOW"],
    [2.9, "LOW"],
    [3, "MEDIUM"],
    [5, "MEDIUM"],
    [7, "MEDIUM"],
    [7.1, "HIGH"],
    [15, "HIGH"],
  ])("classifies a %spp delivery-compliance swing as %s", async (delta, expected) => {
    const prior = makeScopeData({ deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 70, compliancePct: 70 } });
    const current = makeScopeData({
      deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 70 + delta, compliancePct: 70 + delta },
    });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    const change = result.changes.find((c) => c.metric === "deliveryCompliance");
    expect(change?.significance).toBe(expected);
    expect(change?.direction).toBe("up");
  });

  it("classifies a negative delivery-compliance swing as 'down'", async () => {
    const prior = makeScopeData({ deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 80, compliancePct: 80 } });
    const current = makeScopeData({ deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 70, compliancePct: 70 } });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    const change = result.changes.find((c) => c.metric === "deliveryCompliance");
    expect(change?.direction).toBe("down");
    expect(change?.significance).toBe("HIGH");
  });

  it.each([
    [1, "LOW"],
    [1.9, "LOW"],
    [2, "MEDIUM"],
    [4, "MEDIUM"],
    [5, "MEDIUM"],
    [5.1, "HIGH"],
    [20, "HIGH"],
  ])("classifies a %s%% relative enrollment change as %s", async (pctChange, expected) => {
    const prior = makeScopeData({ enrollment: 1000 });
    const current = makeScopeData({ enrollment: Math.round(1000 * (1 + pctChange / 100)) });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    const change = result.changes.find((c) => c.metric === "enrollment");
    expect(change?.significance).toBe(expected);
  });

  it("does not report an enrollment change when prior enrollment was zero (division guard)", async () => {
    const prior = makeScopeData({ enrollment: 0 });
    const current = makeScopeData({ enrollment: 50 });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    expect(result.changes.find((c) => c.metric === "enrollment")).toBeUndefined();
  });

  it("classifies engagement rate (activeStudents/enrollment) as a percentage-point swing, not relative", async () => {
    const prior = makeScopeData({ enrollment: 1000, activeStudents: 500 }); // 50%
    const current = makeScopeData({ enrollment: 1000, activeStudents: 600 }); // 60%, +10pp
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    const change = result.changes.find((c) => c.metric === "engagementRate");
    expect(change?.magnitude).toBeCloseTo(10);
    expect(change?.significance).toBe("HIGH");
  });

  it("reports a per-subject WAEC readiness change keyed by subjectId", async () => {
    const prior = makeScopeData({
      waecReadiness: { studentCount: 100, subjects: [{ subjectId: "physics", name: "Physics", assessedStudents: 50, avgReadiness: 60, atRisk: 10, onTrack: 20 }] },
    });
    const current = makeScopeData({
      waecReadiness: { studentCount: 100, subjects: [{ subjectId: "physics", name: "Physics", assessedStudents: 50, avgReadiness: 70, atRisk: 5, onTrack: 25 }] },
    });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    const change = result.changes.find((c) => c.metric === "waecReadiness.physics");
    expect(change?.magnitude).toBe(10);
    expect(change?.significance).toBe("HIGH");
    expect(change?.direction).toBe("up");
  });

  it("skips a subject present in current but not in prior data (no baseline to diff)", async () => {
    const prior = makeScopeData({ waecReadiness: { studentCount: 0, subjects: [] } });
    const current = makeScopeData({
      waecReadiness: { studentCount: 50, subjects: [{ subjectId: "chemistry", name: "Chemistry", assessedStudents: 50, avgReadiness: 65, atRisk: 5, onTrack: 20 }] },
    });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    expect(result.changes.find((c) => c.metric === "waecReadiness.chemistry")).toBeUndefined();
  });

  it("skips a subject whose avgReadiness is null on either side (unassessed cohort)", async () => {
    const prior = makeScopeData({
      waecReadiness: { studentCount: 0, subjects: [{ subjectId: "physics", name: "Physics", assessedStudents: 0, avgReadiness: null, atRisk: 0, onTrack: 0 }] },
    });
    const current = makeScopeData({
      waecReadiness: { studentCount: 10, subjects: [{ subjectId: "physics", name: "Physics", assessedStudents: 10, avgReadiness: 55, atRisk: 2, onTrack: 3 }] },
    });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    expect(result.changes.find((c) => c.metric === "waecReadiness.physics")).toBeUndefined();
  });

  it("reports multiple independent changes in the same comparison", async () => {
    const prior = makeScopeData({
      enrollment: 1000,
      activeStudents: 500,
      deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 70, compliancePct: 70 },
      waecReadiness: { studentCount: 100, subjects: [{ subjectId: "physics", name: "Physics", assessedStudents: 50, avgReadiness: 60, atRisk: 10, onTrack: 20 }] },
    });
    const current = makeScopeData({
      enrollment: 1100,
      activeStudents: 700,
      deliveryCompliance: { scheduledWorkTotal: 100, scheduledWorkDelivered: 90, compliancePct: 90 },
      waecReadiness: { studentCount: 100, subjects: [{ subjectId: "physics", name: "Physics", assessedStudents: 50, avgReadiness: 50, atRisk: 20, onTrack: 10 }] },
    });
    const result = await moereportDetectNotableChangesTool.handler({ currentData: current, priorData: prior }, CTX);
    expect(result.changes.length).toBe(4);
    expect(result.changes.map((c) => c.metric).sort()).toEqual(
      ["deliveryCompliance", "enrollment", "engagementRate", "waecReadiness.physics"].sort()
    );
  });

  it("does not call any LLM or completion function - pure synchronous math over its inputs", () => {
    expect(moereportDetectNotableChangesTool.estimatedCostUnits).toBe(0);
  });
});

describe("moereport.saveDraftReport", () => {
  beforeEach(resetAll);

  it("always writes status DRAFT regardless of what else is passed", async () => {
    await moereportSaveDraftReportTool.handler(
      {
        scope: "national",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        narrativeText: "This month, enrollment held steady.",
        dataSnapshot: makeScopeData(),
      },
      CTX
    );

    expect(mockPrisma.reportDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT" }) })
    );
  });

  it("has no 'status' field in its input schema - passing one is silently dropped, never reaches the handler's data", () => {
    const parsed = moereportSaveDraftReportTool.inputSchema.parse({
      scope: "national",
      periodType: "monthly",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      narrativeText: "x",
      dataSnapshot: makeScopeData(),
      status: "PUBLISHED",
    } as any);
    expect((parsed as any).status).toBeUndefined();
  });

  it("stores the data snapshot alongside the narrative for later diffing (Escalation Point 1)", async () => {
    const snapshot = makeScopeData();
    await moereportSaveDraftReportTool.handler(
      {
        scope: "district",
        scopeId: "d1",
        periodType: "quarterly",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        narrativeText: "Quarterly update.",
        dataSnapshot: snapshot,
      },
      CTX
    );
    expect(mockPrisma.reportDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dataSnapshot: snapshot, scopeId: "d1" }) })
    );
  });

  it("returns the reportId from the created row", async () => {
    const result = await moereportSaveDraftReportTool.handler(
      {
        scope: "national",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        narrativeText: "x",
        dataSnapshot: makeScopeData(),
      },
      CTX
    );
    expect(result).toEqual({ reportId: "report-1" });
  });

  it("stores a null scopeId for national scope", async () => {
    await moereportSaveDraftReportTool.handler(
      {
        scope: "national",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        narrativeText: "x",
        dataSnapshot: makeScopeData(),
      },
      CTX
    );
    expect(mockPrisma.reportDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scopeId: null }) })
    );
  });
});

describe("moereport.flagForHumanReview", () => {
  beforeEach(resetAll);

  it("routes into the existing EscalationQueue, not a new queue", async () => {
    await moereportFlagForHumanReviewTool.handler({ reportId: "report-1", reason: "compliance figure looks implausible" }, CTX);
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: "moe-narrative-report",
        priority: "MEDIUM",
        schoolId: null,
      })
    );
  });

  it("includes the reportId in the escalation reason for traceability", async () => {
    await moereportFlagForHumanReviewTool.handler({ reportId: "report-42", reason: "check this" }, CTX);
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("report-42") })
    );
  });

  it("returns the flagId from enqueueEscalation", async () => {
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-99" });
    const result = await moereportFlagForHumanReviewTool.handler({ reportId: "report-1", reason: "x" }, CTX);
    expect(result).toEqual({ flagId: "esc-99" });
  });
});

describe("moereport tools authorization", () => {
  it("all five tools require the system role only", () => {
    for (const tool of [
      moereportGetScopeDataTool,
      moereportGetPriorReportTool,
      moereportDetectNotableChangesTool,
      moereportSaveDraftReportTool,
      moereportFlagForHumanReviewTool,
    ]) {
      expect(tool.requiresAuth).toEqual(["system"]);
    }
  });
});
