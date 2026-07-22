import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStandardFindMany = vi.hoisted(() => vi.fn());
const mockContentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    standard: { findMany: mockStandardFindMany },
    curriculumContent: { findMany: mockContentFindMany },
  },
}));

import { buildStandardsBrowser } from "@/lib/moe/standardsBrowser";

describe("buildStandardsBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStandardFindMany.mockResolvedValue([
      { code: "LR-MATH-G1_3-01", description: "Count to 1000", subject: "MATH", band: "G1_3" },
      { code: "LR-MATH-G1_3-02", description: "Add and subtract", subject: "MATH", band: "G1_3" },
      { code: "LR-SCI-G7_9-01", description: "Cell biology", subject: "SCIENCE", band: "G7_9" },
    ]);
    mockContentFindMany.mockResolvedValue([
      {
        contentId: "content-1",
        title: "Counting practice",
        grade: 2,
        moeAlignments: { standards: [{ code: "LR-MATH-G1_3-01", description: "x", confidence: "high" }] },
      },
    ]);
  });

  it("groups real standards by subject and band, all ten subjects represented", async () => {
    const result = await buildStandardsBrowser(null);
    expect(result.subjects).toHaveLength(10);
    const math = result.subjects.find((s) => s.subject === "MATH")!;
    expect(math.hasStandards).toBe(true);
    expect(math.bands).toHaveLength(1);
    expect(math.bands[0].band).toBe("G1_3");
    expect(math.bands[0].standards).toHaveLength(2);
  });

  it("attaches aligned lesson content to the matching standard only", async () => {
    const result = await buildStandardsBrowser(null);
    const math = result.subjects.find((s) => s.subject === "MATH")!;
    const covered = math.bands[0].standards.find((s) => s.code === "LR-MATH-G1_3-01")!;
    const uncovered = math.bands[0].standards.find((s) => s.code === "LR-MATH-G1_3-02")!;
    expect(covered.alignedContent).toEqual([{ contentId: "content-1", title: "Counting practice", grade: 2 }]);
    expect(uncovered.alignedContent).toEqual([]);
  });

  it("honestly reports subjects with zero standards rather than fabricating them", async () => {
    const result = await buildStandardsBrowser(null);
    const engineering = result.subjects.find((s) => s.subject === "ENGINEERING")!;
    expect(engineering.hasStandards).toBe(false);
    expect(engineering.bands).toEqual([]);
  });

  it("scopes aligned content to national lessons plus the requesting school's school_wide lessons", async () => {
    await buildStandardsBrowser("school-cha");
    expect(mockContentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ schoolId: null }, { schoolId: "school-cha", visibility: "school_wide" }],
        }),
      })
    );
  });

  it("scopes to national-only content when the requester has no school context", async () => {
    await buildStandardsBrowser(null);
    expect(mockContentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: null }),
      })
    );
  });
});
