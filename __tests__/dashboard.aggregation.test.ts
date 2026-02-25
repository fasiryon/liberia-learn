/**
 * __tests__/dashboard.aggregation.test.ts
 *
 * Tests for lib/reporting/dashboard/dashboardAggregator.ts â€” Block 9.
 *
 * Verifies:
 *   1. Correct averages for mastery score and baseline growth.
 *   2. Empty dataset returns sentinel-safe zeros for all metrics.
 *   3. Tier distribution sums correctly and maps states correctly.
 *   4. Active students counts distinct students with recent lastAssessedAt.
 *   5. Evidence submission rate = students with any profile / total.
 *   6. Training adoption rate = teachers with progress / total teachers.
 *   7. Monthly report completion rate = completed / total in last 3 months.
 *   8. National aggregates across all students (no school filter).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// â”€â”€â”€ Hoisted mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mockStudentFindMany             = vi.hoisted(() => vi.fn());
const mockStudentCount                = vi.hoisted(() => vi.fn());
const mockMasteryProfileFindMany      = vi.hoisted(() => vi.fn());
const mockUserFindMany                = vi.hoisted(() => vi.fn());
const mockUserCount                   = vi.hoisted(() => vi.fn());
const mockTrainingProgressGroupBy     = vi.hoisted(() => vi.fn());
const mockExportRecordCount           = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: mockStudentFindMany,
      count:   mockStudentCount,
    },
    studentMasteryProfile: {
      findMany: mockMasteryProfileFindMany,
    },
    user: {
      findMany: mockUserFindMany,
      count:   mockUserCount,
    },
    trainingProgress: {
      groupBy: mockTrainingProgressGroupBy,
    },
    exportRecord: {
      count: mockExportRecordCount,
    },
  },
}));

// â”€â”€â”€ Import after mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import {
  computeSchoolDashboard,
  computeNationalDashboard,
  classifyProfileTier,
} from "@/lib/reporting/dashboard/dashboardAggregator";

// â”€â”€â”€ Fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SCHOOL_ID = "school-aaa";

const STUDENTS = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

/** Three profiles covering all four tiers. */
const MASTERY_PROFILES = [
  // Platinum: MASTERED
  {
    currentScore: 0.9,
    baselineScore: 0.5,
    masteryState: "MASTERED",
    proficiencyState: "PROFICIENT",
    lastAssessedAt: new Date("2026-02-20T10:00:00Z"),
  },
  // Gold: PROFICIENT but not MASTERED
  {
    currentScore: 0.8,
    baselineScore: 0.6,
    masteryState: "APPROACHING",
    proficiencyState: "PROFICIENT",
    lastAssessedAt: new Date("2026-02-01T10:00:00Z"),
  },
  // Silver: APPROACHING proficiency
  {
    currentScore: 0.65,
    baselineScore: 0.65,
    masteryState: "DEVELOPING",
    proficiencyState: "APPROACHING",
    lastAssessedAt: new Date("2026-01-01T10:00:00Z"), // > 30 days ago (not active)
  },
];

const TEACHERS = [{ id: "t1" }, { id: "t2" }];

// â”€â”€â”€ Default school mock setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setupSchoolMocks({
  students = STUDENTS,
  profiles = MASTERY_PROFILES,
  activeProfiles = [{ studentId: "s1" }, { studentId: "s2" }],
  profiledStudents = [{ studentId: "s1" }, { studentId: "s2" }],
  teachers = TEACHERS,
  teachersWithProgress = [{ teacherUserId: "t1" }],
  completedReports = 2,
  totalReports = 3,
} = {}) {
  mockStudentFindMany.mockResolvedValue(students);
  // Profile findMany calls:
  // 1. All profiles with all fields (for averages + tiers)
  // 2. Active students (lastAssessedAt >= 30d, distinct studentId)
  // 3. Students with any profile (distinct studentId)
  mockMasteryProfileFindMany
    .mockResolvedValueOnce(profiles)
    .mockResolvedValueOnce(activeProfiles)
    .mockResolvedValueOnce(profiledStudents);
  mockUserFindMany.mockResolvedValue(teachers);
  mockExportRecordCount
    .mockResolvedValueOnce(completedReports)
    .mockResolvedValueOnce(totalReports);
  mockTrainingProgressGroupBy.mockResolvedValue(teachersWithProgress);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// â”€â”€â”€ School: averages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("computeSchoolDashboard â€” averages", () => {
  it("computes correct avgMasteryScore", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    // (0.9 + 0.8 + 0.65) / 3 â‰ˆ 0.7833
    expect(result.avgMasteryScore).toBeCloseTo(0.7833, 3);
  });

  it("computes correct avgBaselineGrowth", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    // growth: (0.4 + 0.2 + 0.0) / 3 â‰ˆ 0.2
    expect(result.avgBaselineGrowth).toBeCloseTo(0.2, 5);
  });

  it("returns totalStudents from student findMany length", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.totalStudents).toBe(3);
  });
});

// â”€â”€â”€ School: empty dataset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("computeSchoolDashboard â€” empty dataset", () => {
  it("returns all-zero metrics when no students exist", async () => {
    mockStudentFindMany.mockResolvedValue([]);

    const result = await computeSchoolDashboard(SCHOOL_ID);

    expect(result.avgMasteryScore).toBe(0);
    expect(result.avgBaselineGrowth).toBe(0);
    expect(result.totalStudents).toBe(0);
    expect(result.activeStudents).toBe(0);
    expect(result.monthlyReportExportShareLast90Days).toBe(0);
    expect(result.evidenceSubmissionRate).toBe(0);
    expect(result.trainingAdoptionRate).toBe(0);
    expect(result.tierDistribution).toEqual({
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    });
  });

  it("handles students with no mastery profiles gracefully", async () => {
    setupSchoolMocks({
      profiles: [],
      activeProfiles: [],
      profiledStudents: [],
    });

    const result = await computeSchoolDashboard(SCHOOL_ID);

    expect(result.avgMasteryScore).toBe(0);
    expect(result.avgBaselineGrowth).toBe(0);
    expect(result.tierDistribution).toEqual({
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    });
    expect(result.evidenceSubmissionRate).toBe(0);
  });

  it("returns trainingAdoptionRate=0 when no teachers", async () => {
    setupSchoolMocks({ teachers: [], teachersWithProgress: [] });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.trainingAdoptionRate).toBe(0);
  });

  it("returns monthlyReportExportShareLast90Days=0 when no reports exist", async () => {
    setupSchoolMocks({ completedReports: 0, totalReports: 0 });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.monthlyReportExportShareLast90Days).toBe(0);
  });
});

// â”€â”€â”€ School: tier distribution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("computeSchoolDashboard â€” tier distribution", () => {
  it("tier distribution sums to total mastery profile count", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    const total = Object.values(result.tierDistribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(MASTERY_PROFILES.length);
  });

  it("MASTERED masteryState â†’ platinum", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.tierDistribution.platinum).toBe(1);
  });

  it("PROFICIENT proficiencyState + non-MASTERED masteryState â†’ gold", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.tierDistribution.gold).toBe(1);
  });

  it("APPROACHING proficiencyState â†’ silver", async () => {
    setupSchoolMocks();
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.tierDistribution.silver).toBe(1);
  });

  it("BELOW_PROFICIENT or NOT_ASSESSED proficiencyState â†’ bronze", async () => {
    setupSchoolMocks({
      profiles: [
        {
          currentScore: 0.3,
          baselineScore: 0.3,
          masteryState: "NOT_ASSESSED",
          proficiencyState: "NOT_ASSESSED",
          lastAssessedAt: null as any,
        },
        {
          currentScore: 0.4,
          baselineScore: 0.3,
          masteryState: "DEVELOPING",
          proficiencyState: "BELOW_PROFICIENT",
          lastAssessedAt: null as any,
        },
      ],
      activeProfiles: [],
      profiledStudents: [{ studentId: "s1" }, { studentId: "s2" }],
    });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.tierDistribution.bronze).toBe(2);
    expect(result.tierDistribution.silver).toBe(0);
    expect(result.tierDistribution.gold).toBe(0);
    expect(result.tierDistribution.platinum).toBe(0);
  });
});

// â”€â”€â”€ School: activity + rates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("computeSchoolDashboard â€” activity and rates", () => {
  it("activeStudents = count of distinct students with recent lastAssessedAt", async () => {
    setupSchoolMocks({ activeProfiles: [{ studentId: "s1" }, { studentId: "s2" }] });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.activeStudents).toBe(2);
  });

  it("evidenceSubmissionRate = profiled students / total students", async () => {
    setupSchoolMocks({ profiledStudents: [{ studentId: "s1" }, { studentId: "s2" }] });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    // 2 / 3 â‰ˆ 0.6667
    expect(result.evidenceSubmissionRate).toBeCloseTo(0.6667, 3);
  });

  it("trainingAdoptionRate = teachers with progress / total teachers", async () => {
    setupSchoolMocks({ teachersWithProgress: [{ teacherUserId: "t1" }] });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    // 1 / 2 = 0.5
    expect(result.trainingAdoptionRate).toBeCloseTo(0.5, 2);
  });

  it("monthlyReportExportShareLast90Days = completed / total reports", async () => {
    setupSchoolMocks({ completedReports: 2, totalReports: 3 });
    const result = await computeSchoolDashboard(SCHOOL_ID);
    expect(result.monthlyReportExportShareLast90Days).toBeCloseTo(0.6667, 3);
  });
});

// â”€â”€â”€ National aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("computeNationalDashboard â€” aggregates across all schools", () => {
  function setupNationalMocks({
    totalStudents = 5,
    profiles = [
      ...MASTERY_PROFILES,
      {
        currentScore: 0.9,
        baselineScore: 0.7,
        masteryState: "MASTERED",
        proficiencyState: "PROFICIENT",
        lastAssessedAt: new Date("2026-02-20T10:00:00Z"),
      },
      {
        currentScore: 0.3,
        baselineScore: 0.3,
        masteryState: "NOT_ASSESSED",
        proficiencyState: "NOT_ASSESSED",
        lastAssessedAt: null as any,
      },
    ],
    activeProfiles = [{ studentId: "s1" }, { studentId: "s2" }, { studentId: "s3" }],
    profiledStudents = [
      { studentId: "s1" },
      { studentId: "s2" },
      { studentId: "s3" },
      { studentId: "s4" },
    ],
    totalTeachers = 4,
    teachersWithProgress = [{ teacherUserId: "t1" }, { teacherUserId: "t2" }],
    completedReports = 8,
    totalReports = 10,
  } = {}) {
    mockStudentCount.mockResolvedValue(totalStudents);
    mockMasteryProfileFindMany
      .mockResolvedValueOnce(profiles)     // all profiles
      .mockResolvedValueOnce(activeProfiles) // active students
      .mockResolvedValueOnce(profiledStudents); // students with any evidence
    mockUserCount.mockResolvedValue(totalTeachers);
    mockTrainingProgressGroupBy.mockResolvedValue(teachersWithProgress);
    mockExportRecordCount
      .mockResolvedValueOnce(completedReports)
      .mockResolvedValueOnce(totalReports);
  }

  it("returns totalStudents from student.count (no school filter)", async () => {
    setupNationalMocks();
    const result = await computeNationalDashboard();
    expect(result.totalStudents).toBe(5);
  });

  it("aggregates avgMasteryScore across all schools' profiles", async () => {
    setupNationalMocks();
    const result = await computeNationalDashboard();
    // 5 profiles: 0.9, 0.8, 0.65, 0.9, 0.3 â†’ avg = 3.55/5 = 0.71
    expect(result.avgMasteryScore).toBeCloseTo(0.71, 2);
  });

  it("national tier distribution includes profiles from all schools", async () => {
    setupNationalMocks();
    const result = await computeNationalDashboard();
    // platinum: 2 (MASTERED), gold: 1 (PROFICIENT+APPROACHING), silver: 1 (APPROACHING), bronze: 1 (NOT_ASSESSED)
    expect(result.tierDistribution.platinum).toBe(2);
    expect(result.tierDistribution.bronze).toBe(1);
    const total = Object.values(result.tierDistribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
  });

  it("national trainingAdoptionRate aggregates all teachers", async () => {
    setupNationalMocks();
    const result = await computeNationalDashboard();
    // 2 / 4 = 0.5
    expect(result.trainingAdoptionRate).toBeCloseTo(0.5, 2);
  });

  it("returns all-zero metrics when no students nationally", async () => {
    mockStudentCount.mockResolvedValue(0);
    const result = await computeNationalDashboard();
    expect(result.totalStudents).toBe(0);
    expect(result.avgMasteryScore).toBe(0);
    expect(result.tierDistribution).toEqual({
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    });
  });
});

// â”€â”€â”€ classifyProfileTier unit tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("classifyProfileTier â€” tier state mapping", () => {
  it("MASTERED â†’ platinum regardless of proficiencyState", () => {
    expect(
      classifyProfileTier({ masteryState: "MASTERED", proficiencyState: "PROFICIENT" })
    ).toBe("platinum");
  });

  it("PROFICIENT + non-MASTERED â†’ gold", () => {
    expect(
      classifyProfileTier({ masteryState: "APPROACHING", proficiencyState: "PROFICIENT" })
    ).toBe("gold");
    expect(
      classifyProfileTier({ masteryState: "DEVELOPING", proficiencyState: "PROFICIENT" })
    ).toBe("gold");
  });

  it("APPROACHING proficiency â†’ silver", () => {
    expect(
      classifyProfileTier({ masteryState: "DEVELOPING", proficiencyState: "APPROACHING" })
    ).toBe("silver");
  });

  it("BELOW_PROFICIENT â†’ bronze", () => {
    expect(
      classifyProfileTier({
        masteryState: "DEVELOPING",
        proficiencyState: "BELOW_PROFICIENT",
      })
    ).toBe("bronze");
  });

  it("NOT_ASSESSED â†’ bronze", () => {
    expect(
      classifyProfileTier({
        masteryState: "NOT_ASSESSED",
        proficiencyState: "NOT_ASSESSED",
      })
    ).toBe("bronze");
  });

  it("DECAYING masteryState + PROFICIENT â†’ gold (not platinum)", () => {
    expect(
      classifyProfileTier({ masteryState: "DECAYING", proficiencyState: "PROFICIENT" })
    ).toBe("gold");
  });
});

