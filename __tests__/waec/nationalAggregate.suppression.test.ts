import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    student: { findMany: vi.fn() },
    studentMasteryProfile: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/waec/syllabus", () => ({
  getWaecSubjects: () => [{ id: "WAEC_MATH", name: "WAEC Mathematics", masterySubject: "MATH" }],
}));
vi.mock("@/lib/waec/readiness", () => ({
  computeSubjectReadiness: (_id: string, map: Record<string, { current: number }>) => ({
    readiness: map.s?.current ?? null,
  }),
}));

import { getNationalWaecReadiness, NATIONAL_MIN_COHORT } from "@/lib/waec/aggregate";

function students(county: string, n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: `${county}-${i + offset}`, county, enrollments: [] }));
}

describe("getNationalWaecReadiness — small-cell suppression", () => {
  beforeEach(() => vi.clearAllMocks());

  it("suppresses counties and subjects with 1-4 assessed learners and keeps larger cohorts", async () => {
    const all = [...students("Bong", 6), ...students("Gbarpolu", 1)];
    mockPrisma.student.findMany.mockResolvedValue(all);
    mockPrisma.studentMasteryProfile.findMany.mockResolvedValue(
      all.map((s, i) => ({ studentId: s.id, strandKey: "s", currentScore: 40 + i, baselineScore: 0 }))
    );

    const result = await getNationalWaecReadiness();

    const gbarpolu = result.byCounty.find((c) => c.county === "Gbarpolu")!;
    expect(gbarpolu).toEqual({ county: "Gbarpolu", assessedStudents: null, avgReadiness: null, suppressed: true });
    const bong = result.byCounty.find((c) => c.county === "Bong")!;
    expect(bong.suppressed).toBe(false);
    expect(bong.assessedStudents).toBe(6);
    expect(bong.avgReadiness).not.toBeNull();
    expect(result.subjects[0].suppressed).toBe(false);
    expect(NATIONAL_MIN_COHORT).toBe(5);
  });

  it("suppresses the national subject row when fewer than 5 learners are assessed", async () => {
    const all = students("Bong", 3);
    mockPrisma.student.findMany.mockResolvedValue(all);
    mockPrisma.studentMasteryProfile.findMany.mockResolvedValue(
      all.map((s) => ({ studentId: s.id, strandKey: "s", currentScore: 30, baselineScore: 0 }))
    );
    const result = await getNationalWaecReadiness();
    expect(result.subjects[0]).toMatchObject({ assessedStudents: null, avgReadiness: null, atRisk: null, onTrack: null, suppressed: true });
  });

  it("keeps zero assessed as visible no-data rather than suppressed", async () => {
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.studentMasteryProfile.findMany.mockResolvedValue([]);
    const result = await getNationalWaecReadiness();
    expect(result.subjects[0]).toMatchObject({ assessedStudents: 0, avgReadiness: null, suppressed: false });
  });
});
