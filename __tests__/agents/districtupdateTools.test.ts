import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrisma,
  mockEnqueueEscalation,
  mockComputeSchoolWeeklyScores,
  mockAggregateWaecForStudents,
  mockGetDeliveryComplianceForSchool,
} = vi.hoisted(() => ({
  mockPrisma: {
    school: { findUnique: vi.fn(), findMany: vi.fn() },
    leagueSnapshot: { findMany: vi.fn() },
    leagueWeekSnapshot: { findMany: vi.fn() },
    student: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    studentStreak: { count: vi.fn() },
    enrollment: { findMany: vi.fn() },
    class: { findUnique: vi.fn(), findMany: vi.fn() },
    districtUpdateDraft: { create: vi.fn(), findUnique: vi.fn() },
  },
  mockEnqueueEscalation: vi.fn(),
  mockComputeSchoolWeeklyScores: vi.fn(),
  mockAggregateWaecForStudents: vi.fn(),
  mockGetDeliveryComplianceForSchool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));
vi.mock("@/lib/waec/aggregate", () => ({ aggregateWaecForStudents: mockAggregateWaecForStudents }));
vi.mock("@/lib/moe/deliveryCompliance", () => ({ getDeliveryComplianceForSchool: mockGetDeliveryComplianceForSchool }));
vi.mock("@/lib/league/weeklyScore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/league/weeklyScore")>();
  return {
    ...actual,
    computeSchoolWeeklyScores: mockComputeSchoolWeeklyScores,
    currentWeekWindow: () => ({
      weekStart: new Date("2026-06-01T00:00:00.000Z"),
      weekEnd: new Date("2026-06-08T00:00:00.000Z"),
    }),
    previousWeekWindow: () => ({
      weekStart: new Date("2026-05-25T00:00:00.000Z"),
      weekEnd: new Date("2026-06-01T00:00:00.000Z"),
    }),
  };
});

import {
  districtupdateGetLeagueStandingsTool,
  districtupdateGetPriorStandingsTool,
  districtupdateDetectStandingsChangesTool,
  districtupdateGetMilestoneCandidatesTool,
  districtupdateSaveDraftUpdateTool,
  districtupdateFlagForHumanReviewTool,
  type Standings,
} from "@/lib/agents/tools/districtupdate.tools";

const CTX = { agentName: "district-update", userId: null, userRole: "system" as const, traceId: "trace-1" };

function resetAll() {
  Object.values(mockPrisma).forEach((delegate) =>
    Object.values(delegate).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  );
  mockEnqueueEscalation.mockReset();
  mockComputeSchoolWeeklyScores.mockReset();
  mockAggregateWaecForStudents.mockReset();
  mockGetDeliveryComplianceForSchool.mockReset();

  mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  mockComputeSchoolWeeklyScores.mockResolvedValue([]);
  mockAggregateWaecForStudents.mockResolvedValue([]);
  mockGetDeliveryComplianceForSchool.mockResolvedValue({ schoolId: "s1", scheduledWorkTotal: 0, scheduledWorkDelivered: 0, compliancePct: null });
  mockPrisma.districtUpdateDraft.create.mockResolvedValue({ id: "update-1" });
  mockPrisma.student.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.studentStreak.count.mockResolvedValue(0);
  mockPrisma.enrollment.findMany.mockResolvedValue([]);
  mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
}

const THREE_SCHOOL_DISTRICT = [
  { schoolId: "s-a", schoolName: "School A", district: "Montserrado", pointsTotal: 900, enrollmentCount: 100, score: 90 },
  { schoolId: "s-b", schoolName: "School B", district: "Montserrado", pointsTotal: 800, enrollmentCount: 100, score: 80 },
  { schoolId: "s-c", schoolName: "School C", district: "Montserrado", pointsTotal: 700, enrollmentCount: 100, score: 70 },
];

function makeStandings(overrides: Partial<Standings> = {}): Standings {
  return {
    scope: "district",
    scopeId: "Montserrado",
    periodType: "weekly",
    periodLabel: "2026-06-01",
    standings: [
      { schoolId: "s-a", schoolName: "School A", rank: 1, score: 90 },
      { schoolId: "s-b", schoolName: "School B", rank: 2, score: 80 },
      { schoolId: "s-c", schoolName: "School C", rank: 3, score: 70 },
    ],
    ...overrides,
  };
}

describe("districtupdate.getLeagueStandings", () => {
  beforeEach(resetAll);

  it("returns the full ranked list for a district (weekly)", async () => {
    mockComputeSchoolWeeklyScores.mockResolvedValue(THREE_SCHOOL_DISTRICT);
    const result = await districtupdateGetLeagueStandingsTool.handler(
      { scope: "district", scopeId: "Montserrado", periodType: "weekly" },
      CTX
    );
    expect(result.standings).toHaveLength(3);
    expect(result.standings[0]).toEqual({ schoolId: "s-a", schoolName: "School A", rank: 1, score: 90 });
    expect(result.periodType).toBe("weekly");
  });

  it("returns only the requested school's own entry for school scope (weekly)", async () => {
    mockComputeSchoolWeeklyScores.mockResolvedValue(THREE_SCHOOL_DISTRICT);
    const result = await districtupdateGetLeagueStandingsTool.handler(
      { scope: "school", scopeId: "s-b", periodType: "weekly" },
      CTX
    );
    expect(result.standings).toEqual([{ schoolId: "s-b", schoolName: "School B", rank: 2, score: 80 }]);
  });

  it("returns an empty standings array for a school not found in any district (weekly)", async () => {
    mockComputeSchoolWeeklyScores.mockResolvedValue(THREE_SCHOOL_DISTRICT);
    const result = await districtupdateGetLeagueStandingsTool.handler(
      { scope: "school", scopeId: "ghost-school", periodType: "weekly" },
      CTX
    );
    expect(result.standings).toEqual([]);
  });

  it("queries LeagueSnapshot ordered by districtRank for monthly/termly district scope", async () => {
    mockPrisma.leagueSnapshot.findMany.mockResolvedValue([
      { schoolId: "s-a", districtRank: 1, avgGrade: 80, attendance: 90, lessonCompletion: 70, school: { name: "School A" } },
      { schoolId: "s-b", districtRank: 2, avgGrade: 70, attendance: 80, lessonCompletion: 60, school: { name: "School B" } },
    ]);
    const result = await districtupdateGetLeagueStandingsTool.handler(
      { scope: "district", scopeId: "Montserrado", periodType: "monthly" },
      CTX
    );
    expect(mockPrisma.leagueSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ school: { district: "Montserrado" } }),
        orderBy: { districtRank: "asc" },
      })
    );
    expect(result.standings).toHaveLength(2);
    expect(result.periodType).toBe("monthly");
  });

  it("filters out LeagueSnapshot rows with a null districtRank (monthly)", async () => {
    mockPrisma.leagueSnapshot.findMany.mockResolvedValue([
      { schoolId: "s-a", districtRank: null, avgGrade: 80, attendance: 90, lessonCompletion: 70, school: { name: "School A" } },
    ]);
    const result = await districtupdateGetLeagueStandingsTool.handler(
      { scope: "district", scopeId: "Montserrado", periodType: "monthly" },
      CTX
    );
    expect(result.standings).toEqual([]);
  });
});

describe("districtupdate.getPriorStandings", () => {
  beforeEach(resetAll);

  it("returns null when no prior weekly snapshot rows exist", async () => {
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    const result = await districtupdateGetPriorStandingsTool.handler(
      { scope: "district", scopeId: "Montserrado", periodType: "weekly" },
      CTX
    );
    expect(result).toBeNull();
  });

  it("returns prior weekly standings ordered by rank when rows exist", async () => {
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([
      { schoolId: "s-a", schoolName: "School A", rank: 1, score: 85 },
      { schoolId: "s-b", schoolName: "School B", rank: 2, score: 75 },
    ]);
    const result = await districtupdateGetPriorStandingsTool.handler(
      { scope: "district", scopeId: "Montserrado", periodType: "weekly" },
      CTX
    );
    expect(mockPrisma.leagueWeekSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district: "Montserrado", weekStart: new Date("2026-05-25T00:00:00.000Z") }),
        orderBy: { rank: "asc" },
      })
    );
    expect(result?.standings).toHaveLength(2);
  });

  it("filters by schoolId (not district) for school scope (weekly)", async () => {
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    await districtupdateGetPriorStandingsTool.handler({ scope: "school", scopeId: "s-a", periodType: "weekly" }, CTX);
    expect(mockPrisma.leagueWeekSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: "s-a" }) })
    );
  });

  it("returns null when no prior LeagueSnapshot rows exist for the term (monthly)", async () => {
    mockPrisma.leagueSnapshot.findMany.mockResolvedValue([]);
    const result = await districtupdateGetPriorStandingsTool.handler(
      { scope: "district", scopeId: "Montserrado", periodType: "monthly" },
      CTX
    );
    expect(result).toBeNull();
  });
});

describe("districtupdate.detectStandingsChanges (deterministic thresholds)", () => {
  beforeEach(resetAll);

  it("returns no changes when there is no prior period to diff against", async () => {
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: makeStandings(), priorStandings: null },
      CTX
    );
    expect(result.changes).toEqual([]);
  });

  it("skips a school whose rank did not change", async () => {
    const standings = makeStandings();
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: standings, priorStandings: standings },
      CTX
    );
    expect(result.changes).toEqual([]);
  });

  it.each([
    [1, "LOW"],
    [2, "MEDIUM"],
    [3, "MEDIUM"],
    [4, "HIGH"],
    [10, "HIGH"],
  ])("classifies a %s-position move as %s (staying clear of rank 1, isolating the pure position-count rule)", async (positions, expected) => {
    // School A moves from rank 15 toward rank 1 but never reaches it, so the
    // "became #1" always-HIGH override never fires here - see the dedicated
    // #1-crossing tests below for that rule in isolation.
    const prior = makeStandings({ standings: [{ schoolId: "s-a", schoolName: "School A", rank: 15, score: 50 }] });
    const current = makeStandings({ standings: [{ schoolId: "s-a", schoolName: "School A", rank: 15 - positions, score: 90 }] });
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: current, priorStandings: prior },
      CTX
    );
    const change = result.changes.find((c) => c.entity === "School A");
    expect(change?.significance).toBe(expected);
    expect(change?.positions_moved).toBe(positions);
    expect(change?.direction).toBe("up");
  });

  it("reports 'down' direction for a school that dropped in rank", async () => {
    const prior = makeStandings({ standings: [{ schoolId: "s-a", schoolName: "School A", rank: 1, score: 90 }] });
    const current = makeStandings({ standings: [{ schoolId: "s-a", schoolName: "School A", rank: 3, score: 50 }] });
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: current, priorStandings: prior },
      CTX
    );
    expect(result.changes[0].direction).toBe("down");
  });

  it("always classifies becoming #1 as HIGH even with only a 1-position move", async () => {
    const prior = makeStandings({
      standings: [
        { schoolId: "s-a", schoolName: "School A", rank: 2, score: 80 },
        { schoolId: "s-b", schoolName: "School B", rank: 1, score: 85 },
      ],
    });
    const current = makeStandings({
      standings: [
        { schoolId: "s-a", schoolName: "School A", rank: 1, score: 88 },
        { schoolId: "s-b", schoolName: "School B", rank: 2, score: 80 },
      ],
    });
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: current, priorStandings: prior },
      CTX
    );
    const change = result.changes.find((c) => c.entity === "School A");
    expect(change?.positions_moved).toBe(1);
    expect(change?.significance).toBe("HIGH");
  });

  it("always classifies losing #1 as HIGH even with only a 1-position move", async () => {
    const prior = makeStandings({
      standings: [
        { schoolId: "s-a", schoolName: "School A", rank: 1, score: 85 },
        { schoolId: "s-b", schoolName: "School B", rank: 2, score: 80 },
      ],
    });
    const current = makeStandings({
      standings: [
        { schoolId: "s-a", schoolName: "School A", rank: 2, score: 80 },
        { schoolId: "s-b", schoolName: "School B", rank: 1, score: 88 },
      ],
    });
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: current, priorStandings: prior },
      CTX
    );
    const change = result.changes.find((c) => c.entity === "School A");
    expect(change?.significance).toBe("HIGH");
  });

  it("skips a school present in current but not in prior standings (new entrant, no baseline)", async () => {
    const prior = makeStandings({ standings: [{ schoolId: "s-a", schoolName: "School A", rank: 1, score: 90 }] });
    const current = makeStandings({
      standings: [
        { schoolId: "s-a", schoolName: "School A", rank: 1, score: 90 },
        { schoolId: "s-new", schoolName: "New School", rank: 2, score: 60 },
      ],
    });
    const result = await districtupdateDetectStandingsChangesTool.handler(
      { currentStandings: current, priorStandings: prior },
      CTX
    );
    expect(result.changes.find((c) => c.entity === "New School")).toBeUndefined();
  });

  it("does not call any LLM or completion function - pure synchronous math over its inputs", () => {
    expect(districtupdateDetectStandingsChangesTool.estimatedCostUnits).toBe(0);
  });
});

describe("districtupdate.getMilestoneCandidates", () => {
  beforeEach(resetAll);

  it("returns an empty candidates array when nothing qualifies (school scope)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    mockAggregateWaecForStudents.mockResolvedValue([]);
    mockPrisma.studentStreak.count.mockResolvedValue(0);
    mockGetDeliveryComplianceForSchool.mockResolvedValue({ schoolId: "s-a", scheduledWorkTotal: 0, scheduledWorkDelivered: 0, compliancePct: null });

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    expect(result.candidates).toEqual([]);
  });

  it("surfaces league_standing_improved when the school's rank improved since last week", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([
      { schoolId: "s-a", schoolName: "School A", district: "Montserrado", pointsTotal: 900, enrollmentCount: 100, score: 90 },
    ]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([
      { schoolId: "s-a", schoolName: "School A", district: "Montserrado", rank: 3, score: 70 },
    ]);

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    const standing = result.candidates.find((c) => c.type === "league_standing_improved");
    expect(standing).toBeDefined();
    expect(standing?.detail.positionsMoved).toBe(2);
  });

  it("does not surface league_standing_improved when the rank got worse or stayed the same", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([
      { schoolId: "s-a", schoolName: "School A", district: "Montserrado", pointsTotal: 700, enrollmentCount: 100, score: 70 },
    ]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([
      { schoolId: "s-a", schoolName: "School A", district: "Montserrado", rank: 1, score: 90 },
    ]);
    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    expect(result.candidates.find((c) => c.type === "league_standing_improved")).toBeUndefined();
  });

  it("surfaces waec_readiness_on_track only for subjects with avgReadiness >= 75", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
    mockPrisma.student.findMany.mockResolvedValue([{ id: "student-1" }]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    mockAggregateWaecForStudents.mockResolvedValue([
      { subjectId: "waec_math", name: "WAEC Mathematics", assessedStudents: 10, avgReadiness: 80, atRisk: 0, onTrack: 8 },
      { subjectId: "waec_biology", name: "WAEC Biology", assessedStudents: 10, avgReadiness: 60, atRisk: 2, onTrack: 3 },
      { subjectId: "waec_physics", name: "WAEC Physics", assessedStudents: 0, avgReadiness: null, atRisk: 0, onTrack: 0 },
    ]);

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    const waecCandidates = result.candidates.filter((c) => c.type === "waec_readiness_on_track");
    expect(waecCandidates).toHaveLength(1);
    expect(waecCandidates[0].detail.subject).toBe("WAEC Mathematics");
  });

  it("surfaces engagement_streak only when at least 3 students meet a threshold, choosing the highest qualifying threshold", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.studentStreak.count.mockImplementation(async ({ where }: any) => {
      const threshold = where.currentStreak.gte;
      if (threshold <= 14) return 3;
      return 0;
    });

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    const streak = result.candidates.find((c) => c.type === "engagement_streak");
    expect(streak?.detail.thresholdDays).toBe(14);
    expect(streak?.detail.studentCount).toBe(3);
  });

  it("does not surface engagement_streak when fewer than 3 students qualify at every threshold", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.studentStreak.count.mockResolvedValue(1);

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    expect(result.candidates.find((c) => c.type === "engagement_streak")).toBeUndefined();
  });

  it("surfaces delivery_compliance at the highest threshold met (school scope)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    mockGetDeliveryComplianceForSchool.mockResolvedValue({ schoolId: "s-a", scheduledWorkTotal: 100, scheduledWorkDelivered: 92, compliancePct: 92 });

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    const compliance = result.candidates.find((c) => c.type === "delivery_compliance");
    expect(compliance?.detail.thresholdPct).toBe(90);
  });

  it("does not surface delivery_compliance when compliancePct is null (no scheduled work)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockComputeSchoolWeeklyScores.mockResolvedValue([]);
    mockPrisma.leagueWeekSnapshot.findMany.mockResolvedValue([]);
    mockGetDeliveryComplianceForSchool.mockResolvedValue({ schoolId: "s-a", scheduledWorkTotal: 0, scheduledWorkDelivered: 0, compliancePct: null });

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "school", scopeId: "s-a" }, CTX);
    expect(result.candidates.find((c) => c.type === "delivery_compliance")).toBeUndefined();
  });

  it("class scope only checks engagement_streak and delivery_compliance, never league or WAEC", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([{ Student: { userId: "u1" } }, { Student: { userId: "u2" } }, { Student: { userId: "u3" } }]);
    mockPrisma.studentStreak.count.mockResolvedValue(3);
    mockPrisma.class.findUnique.mockResolvedValue({
      name: "Grade 5 Math",
      scheduledWork: [{ id: "sw1", isDelivered: true }, { id: "sw2", isDelivered: true }],
    });

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "class", scopeId: "class-1" }, CTX);
    expect(result.candidates.every((c) => c.type === "engagement_streak" || c.type === "delivery_compliance")).toBe(true);
    expect(mockComputeSchoolWeeklyScores).not.toHaveBeenCalled();
    expect(mockAggregateWaecForStudents).not.toHaveBeenCalled();
  });

  it("computes class delivery compliance directly from that class's scheduledWork, not the school-wide helper", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.class.findUnique.mockResolvedValue({
      name: "Grade 5 Math",
      scheduledWork: [
        { id: "sw1", isDelivered: true },
        { id: "sw2", isDelivered: true },
        { id: "sw3", isDelivered: true },
        { id: "sw4", isDelivered: false },
      ],
    });

    const result = await districtupdateGetMilestoneCandidatesTool.handler({ scope: "class", scopeId: "class-1" }, CTX);
    expect(mockGetDeliveryComplianceForSchool).not.toHaveBeenCalled();
    const compliance = result.candidates.find((c) => c.type === "delivery_compliance");
    expect(compliance?.detail.compliancePct).toBe(75);
    expect(compliance?.detail.thresholdPct).toBe(75);
  });
});

describe("districtupdate.saveDraftUpdate", () => {
  beforeEach(resetAll);

  it("always writes status DRAFT regardless of what else is passed", async () => {
    await districtupdateSaveDraftUpdateTool.handler(
      {
        type: "standings",
        scope: "district",
        scopeId: "Montserrado",
        draftText: "Zwedru moved up this week.",
        dataSnapshot: makeStandings(),
      },
      CTX
    );
    expect(mockPrisma.districtUpdateDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT" }) })
    );
  });

  it("has no 'status' field in its input schema - passing one is silently dropped", () => {
    const parsed = districtupdateSaveDraftUpdateTool.inputSchema.parse({
      type: "milestone",
      scope: "school",
      scopeId: "s-a",
      draftText: "x",
      dataSnapshot: {},
      status: "PUBLISHED",
    } as any);
    expect((parsed as any).status).toBeUndefined();
  });

  it("returns the updateId from the created row", async () => {
    const result = await districtupdateSaveDraftUpdateTool.handler(
      { type: "milestone", scope: "school", scopeId: "s-a", draftText: "x", dataSnapshot: {} },
      CTX
    );
    expect(result).toEqual({ updateId: "update-1" });
  });

  it("accepts changesSummary omitted or null equivalently for a milestone draft", async () => {
    await districtupdateSaveDraftUpdateTool.handler(
      { type: "milestone", scope: "school", scopeId: "s-a", draftText: "x", dataSnapshot: {}, changesSummary: null },
      CTX
    );
    expect(mockPrisma.districtUpdateDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ changesSummary: null }) })
    );
  });
});

describe("districtupdate.flagForHumanReview", () => {
  beforeEach(resetAll);

  it("routes into the existing EscalationQueue, not a new queue", async () => {
    mockPrisma.districtUpdateDraft.findUnique.mockResolvedValue({ scope: "school", scopeId: "s-a" });
    await districtupdateFlagForHumanReviewTool.handler({ updateId: "update-1", reason: "numbers look off" }, CTX);
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "district-update", priority: "MEDIUM", schoolId: "s-a" })
    );
  });

  it("resolves schoolId via the class's own schoolId for class-scope drafts", async () => {
    mockPrisma.districtUpdateDraft.findUnique.mockResolvedValue({ scope: "class", scopeId: "class-1" });
    mockPrisma.class.findUnique.mockResolvedValue({ schoolId: "s-owner" });
    await districtupdateFlagForHumanReviewTool.handler({ updateId: "update-1", reason: "check this" }, CTX);
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "s-owner" }));
  });

  it("passes a null schoolId for district-scope drafts (spans multiple schools)", async () => {
    mockPrisma.districtUpdateDraft.findUnique.mockResolvedValue({ scope: "district", scopeId: "Montserrado" });
    await districtupdateFlagForHumanReviewTool.handler({ updateId: "update-1", reason: "check this" }, CTX);
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ schoolId: null }));
  });

  it("returns the flagId from enqueueEscalation", async () => {
    mockPrisma.districtUpdateDraft.findUnique.mockResolvedValue(null);
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-99" });
    const result = await districtupdateFlagForHumanReviewTool.handler({ updateId: "ghost", reason: "x" }, CTX);
    expect(result).toEqual({ flagId: "esc-99" });
  });
});

describe("districtupdate tools authorization", () => {
  it("all six tools require the system role only", () => {
    for (const tool of [
      districtupdateGetLeagueStandingsTool,
      districtupdateGetPriorStandingsTool,
      districtupdateDetectStandingsChangesTool,
      districtupdateGetMilestoneCandidatesTool,
      districtupdateSaveDraftUpdateTool,
      districtupdateFlagForHumanReviewTool,
    ]) {
      expect(tool.requiresAuth).toEqual(["system"]);
    }
  });
});
