import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentMasteryProfile: {
      findMany: mockFindMany,
    },
  },
}));

import { computeNationalCurriculumSignals } from "@/lib/reporting/curriculum/nationalCurriculumSignals";

describe("computeNationalCurriculumSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies minimum sample threshold and deterministic ordering", async () => {
    mockFindMany.mockResolvedValue([
      {
        subject: "MATH",
        strandKey: "fractions",
        currentScore: 0.5,
        baselineScore: 0.6,
        StrandCatalog: { name: "Fractions", gradeBand: "G4_6" },
      },
      {
        subject: "MATH",
        strandKey: "fractions",
        currentScore: 0.6,
        baselineScore: 0.6,
        StrandCatalog: { name: "Fractions", gradeBand: "G4_6" },
      },
      {
        subject: "MATH",
        strandKey: "geometry",
        currentScore: 0.55,
        baselineScore: 0.6,
        StrandCatalog: { name: "Geometry", gradeBand: "G4_6" },
      },
      {
        subject: "MATH",
        strandKey: "geometry",
        currentScore: 0.55,
        baselineScore: 0.6,
        StrandCatalog: { name: "Geometry", gradeBand: "G4_6" },
      },
      {
        subject: "SCIENCE",
        strandKey: "ecosystems",
        currentScore: 0.4,
        baselineScore: 0.45,
        StrandCatalog: { name: "Ecosystems", gradeBand: "G7_9" },
      },
      {
        subject: "SCIENCE",
        strandKey: "ecosystems",
        currentScore: 0.5,
        baselineScore: 0.45,
        StrandCatalog: { name: "Ecosystems", gradeBand: "G7_9" },
      },
      {
        subject: "SCIENCE",
        strandKey: "chemistry",
        currentScore: 0.3,
        baselineScore: 0.4,
        StrandCatalog: { name: "Chemistry", gradeBand: "G7_9" },
      },
    ]);

    const result = await computeNationalCurriculumSignals({
      minSampleSize: 2,
      weakBottomN: 1,
      weakMasteryThreshold: 0.58,
    });

    expect(result.summary.totalProfilesConsidered).toBe(7);
    expect(result.summary.eligibleStrandCount).toBe(3);
    expect(result.summary.filteredOutBySample).toBe(1);

    expect(result.rows.map((r) => r.strandKey)).toEqual([
      "ecosystems",
      "fractions",
      "geometry",
    ]);

    expect(result.weakByGradeBand.G4_6.map((s) => s.strandKey)).toEqual([
      "fractions",
      "geometry",
    ]);
    expect(result.weakByGradeBand.G7_9.map((s) => s.strandKey)).toEqual(["ecosystems"]);
  });

  it("marks weak strands with reasons including declining trend", async () => {
    mockFindMany.mockResolvedValue([
      {
        subject: "MATH",
        strandKey: "algebra",
        currentScore: 0.4,
        baselineScore: 0.6,
        StrandCatalog: { name: "Algebra", gradeBand: "G10_12" },
      },
      {
        subject: "MATH",
        strandKey: "algebra",
        currentScore: 0.45,
        baselineScore: 0.62,
        StrandCatalog: { name: "Algebra", gradeBand: "G10_12" },
      },
    ]);

    const result = await computeNationalCurriculumSignals({
      minSampleSize: 1,
      weakBottomN: 1,
      weakMasteryThreshold: 0.7,
    });

    const weak = result.weakByGradeBand.G10_12[0];
    expect(weak.reasons).toContain("bottom_ranked_within_grade_band");
    expect(weak.reasons).toContain("below_mastery_threshold");
    expect(weak.reasons).toContain("declining_mastery_delta");
    expect(weak.trendDirection).toBe("declining");
  });
});
