import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockStudentMasteryFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockAssessmentAttemptFindMany = vi.hoisted(() => vi.fn());
const mockExamAttemptFindMany = vi.hoisted(() => vi.fn());
const mockLabSessionFindMany = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockCertificateFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockStudentBadgeAwardFindMany = vi.hoisted(() => vi.fn());
const mockStudentBadgeAwardCreate = vi.hoisted(() => vi.fn());
const mockStudentBadgeAwardFindFirst = vi.hoisted(() => vi.fn());
const mockStudentBadgeAwardCount = vi.hoisted(() => vi.fn());
const mockDerivedStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockInterventionChainFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    studentMasteryProfile: { findMany: mockStudentMasteryFindMany },
    studentProgress: { findMany: mockStudentProgressFindMany },
    assessmentAttempt: { findMany: mockAssessmentAttemptFindMany },
    examAttempt: { findMany: mockExamAttemptFindMany },
    labSession: { findMany: mockLabSessionFindMany },
    class: { findMany: mockClassFindMany },
    certificate: { findUnique: mockCertificateFindUnique },
    scheduledWork: { findUnique: mockScheduledWorkFindUnique },
    studentBadgeAward: {
      findMany: mockStudentBadgeAwardFindMany,
      create: mockStudentBadgeAwardCreate,
      findFirst: mockStudentBadgeAwardFindFirst,
      count: mockStudentBadgeAwardCount,
    },
    derivedStudentProgress: { findMany: mockDerivedStudentProgressFindMany },
    interventionChain: { findMany: mockInterventionChainFindMany },
  },
}));

describe("Credentials & Outcomes computed services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      userId: "user-1",
      currentGrade: 6,
      user: { schoolId: "school-1" },
    });
    mockStudentBadgeAwardFindMany.mockResolvedValue([]);
    mockStudentBadgeAwardCreate.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `award-${data.badgeKey}`,
        badgeKey: data.badgeKey,
        awardedAt: data.awardedAt,
        criteriaVersion: data.criteriaVersion,
      })
    );
    mockStudentBadgeAwardFindFirst.mockResolvedValue(null);
    mockStudentBadgeAwardCount.mockResolvedValue(0);
    mockDerivedStudentProgressFindMany.mockResolvedValue([]);
    mockInterventionChainFindMany.mockResolvedValue([]);
    mockStudentMasteryFindMany.mockResolvedValue([
      {
        subject: "MATH",
        strandKey: "fractions-equivalence",
        currentScore: 0.86,
        masteryState: "MASTERED",
        lastAssessedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      {
        subject: "ENGLISH",
        strandKey: "reading-comprehension",
        currentScore: 72,
        masteryState: "PRACTICING",
        lastAssessedAt: new Date("2026-02-02T00:00:00.000Z"),
      },
      {
        subject: "SCIENCE",
        strandKey: "matter-properties",
        currentScore: 48,
        masteryState: "DEVELOPING",
        lastAssessedAt: new Date("2026-02-03T00:00:00.000Z"),
      },
    ]);
    mockStudentProgressFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        completedAt: new Date(`2026-02-0${index + 1}T00:00:00.000Z`),
        scheduledWork: { content: { subject: index % 2 === 0 ? "MATH" : "SCIENCE" } },
      }))
    );
    mockAssessmentAttemptFindMany.mockResolvedValue([
      { subject: "MATH", score: 8, maxScore: 10 },
      { subject: "SCIENCE", score: 4, maxScore: 10 },
    ]);
    mockExamAttemptFindMany.mockResolvedValue([
      {
        score: 0.78,
        passed: true,
        submittedAt: new Date("2026-02-10T00:00:00.000Z"),
        exam: { subject: "MATH" },
      },
    ]);
    mockLabSessionFindMany.mockResolvedValue([
      {
        id: "lab-1",
        labId: "science-lab-1",
        score: 82,
        completedAt: new Date("2026-02-08T00:00:00.000Z"),
      },
    ]);
  });

  it("awards explainable skill badges from existing mastery, lab, lesson, and exam data", async () => {
    const { buildStudentSkillBadges } = await import("@/lib/badges/studentBadges");

    const badges = await buildStudentSkillBadges("student-1");

    expect(badges.find((badge) => badge.id === "fractions-mastery")).toMatchObject({
      earned: true,
      criteria: expect.stringContaining("fractions"),
    });
    expect(badges.find((badge) => badge.id === "science-lab-completion")).toMatchObject({
      earned: true,
      evidence: ["science-lab-1 (82%)"],
    });
    expect(badges.find((badge) => badge.id === "consistent-lesson-completion")).toMatchObject({
      earned: true,
    });
    expect(badges.find((badge) => badge.id === "exam-readiness-milestone")).toMatchObject({
      earned: true,
    });
  });

  it("persists newly eligible badges with tenant scope and stable award timestamps", async () => {
    const { buildStudentSkillBadges } = await import("@/lib/badges/studentBadges");

    const badges = await buildStudentSkillBadges("student-1");
    const fractionBadge = badges.find((badge) => badge.id === "fractions-mastery");

    expect(mockStudentBadgeAwardCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          studentId: "student-1",
          badgeKey: "fractions-mastery",
          criteriaVersion: "v1",
          evidenceType: "mastery_profile",
        }),
      })
    );
    expect(fractionBadge).toMatchObject({
      awardId: "award-fractions-mastery",
      earnedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("uses persisted awardedAt and does not create duplicate badge awards", async () => {
    mockStudentBadgeAwardFindMany.mockResolvedValue([
      {
        id: "persisted-award",
        badgeKey: "fractions-mastery",
        awardedAt: new Date("2026-01-15T00:00:00.000Z"),
        criteriaVersion: "v1",
      },
    ]);
    const { buildStudentSkillBadges } = await import("@/lib/badges/studentBadges");

    const badges = await buildStudentSkillBadges("student-1");
    const fractionBadge = badges.find((badge) => badge.id === "fractions-mastery");

    expect(mockStudentBadgeAwardCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ badgeKey: "fractions-mastery" }),
      })
    );
    expect(fractionBadge).toMatchObject({
      awardId: "persisted-award",
      earnedAt: "2026-01-15T00:00:00.000Z",
    });
  });

  it("backfills badge awards only for explicitly supplied students", async () => {
    mockStudentBadgeAwardCount.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    const { backfillStudentBadgeAwards } = await import("@/lib/badges/studentBadges");

    const result = await backfillStudentBadgeAwards(["student-1"]);

    expect(result).toEqual({ processed: 1, awarded: 2 });
    expect(mockStudentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "student-1" } })
    );
  });

  it("computes deterministic exam readiness and weak-topic recommendations", async () => {
    const { buildStudentExamReadiness } = await import("@/lib/outcomes/examReadiness");

    const readiness = await buildStudentExamReadiness("student-1");

    expect(readiness.readinessScore).not.toBeNull();
    expect(readiness.strongSubjects).toContain("MATH");
    expect(readiness.weakSubjects).toContain("SCIENCE");
    expect(readiness.recommendedPractice[0]).toContain("SCIENCE");
    expect(readiness.nextBestAction?.href).toBe("/student/adaptive");
  });

  it("builds teacher summaries only from classes supplied by the scoped teacher query", async () => {
    mockClassFindMany.mockResolvedValue([
      {
        id: "class-1",
        name: "Grade 6 Science",
        subject: "SCIENCE",
        gradeLevel: 6,
        enrollments: [{ Student: { id: "student-1", user: { name: "Ada" } } }],
      },
    ]);
    const { buildTeacherExamReadinessSummary } = await import("@/lib/outcomes/examReadiness");

    const summary = await buildTeacherExamReadinessSummary("teacher-1", "school-1");

    expect(mockClassFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: "teacher-1", schoolId: "school-1" },
      })
    );
    expect(summary.classSummaries[0]).toMatchObject({
      classId: "class-1",
      studentCount: 1,
    });
  });

  it("builds internal pathway recommendations from badges and readiness signals", async () => {
    const { buildStudentSkillBadges } = await import("@/lib/badges/studentBadges");
    const { buildStudentExamReadiness } = await import("@/lib/outcomes/examReadiness");
    const { buildPathwayHooks } = await import("@/lib/outcomes/pathways");

    const badges = await buildStudentSkillBadges("student-1");
    const readiness = await buildStudentExamReadiness("student-1");
    const pathways = buildPathwayHooks(readiness, badges);

    expect(pathways).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathwayKey: "stem-foundation",
          category: "STEM",
          readinessLevel: expect.any(String),
          supportingBadges: expect.arrayContaining(["fractions-mastery", "science-lab-completion"]),
          recommendedNextActions: expect.any(Array),
          externalIntegrations: expect.arrayContaining([
            expect.objectContaining({ status: "not_configured" }),
          ]),
        }),
      ])
    );
  });

  it("keeps MOE outcomes aggregate-only with no student PII", async () => {
    mockStudentBadgeAwardFindMany.mockResolvedValue([
      { badgeKey: "fractions-mastery" },
      { badgeKey: "fractions-mastery" },
    ]);
    const { buildMoeOutcomesSummary } = await import("@/lib/outcomes/examReadiness");

    const summary = await buildMoeOutcomesSummary();
    const serialized = JSON.stringify(summary);

    expect(summary.badgeAwardsByKey).toContainEqual({ badgeKey: "fractions-mastery", awardCount: 2 });
    expect(serialized).not.toContain("student-1");
    expect(serialized).not.toContain("Ada");
  });

  it("student passport returns badges with persisted award timestamps", async () => {
    mockStudentBadgeAwardFindMany.mockResolvedValue([
      {
        id: "persisted-award",
        badgeKey: "fractions-mastery",
        awardedAt: new Date("2026-01-15T00:00:00.000Z"),
        criteriaVersion: "v1",
      },
    ]);
    const { buildStudentPassport } = await import("@/lib/passport/buildStudentPassport");

    const passport = await buildStudentPassport("student-1");
    const fractionBadge = passport.badges.find((badge) => badge.id === "fractions-mastery");

    expect(fractionBadge).toMatchObject({
      awardId: "persisted-award",
      earnedAt: "2026-01-15T00:00:00.000Z",
    });
    expect(passport.pathwayHooks[0]).toHaveProperty("readinessLevel");
  });
});

describe("certificate public verification privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCertificateFindUnique.mockResolvedValue({
      certificateCode: "ABC12345",
      type: "SUBJECT",
      referenceId: "MATH",
      awardedAt: new Date("2026-02-12T00:00:00.000Z"),
      student: { user: { name: "Ada Johnson" } },
    });
  });

  it("returns only the public first name and verification fields", async () => {
    const { getCertificateVerification } = await import("@/lib/certificates/certificateService");

    const result = await getCertificateVerification("ABC12345");

    expect(result).toEqual({
      studentFirstName: "Ada",
      completed: "MATH subject certificate",
      awardedAt: "2026-02-12T00:00:00.000Z",
      certificateCode: "ABC12345",
    });
    expect(JSON.stringify(result)).not.toContain("Johnson");
  });
});
