import { describe, expect, it } from "vitest";
import { buildRepositoryOnlyCoverageReport } from "@/lib/learning-authority/curriculumCoverageProgram";

describe("repository curriculum source inventory", () => {
  it("keeps documented MOE sources distinct from importable source bytes", () => {
    const report = buildRepositoryOnlyCoverageReport({
      scope: { grades: [1, 4, 10], subjects: ["MATH", "LITERACY", "SCIENCE", "SOCIAL_STUDIES"] },
      databaseError: "test",
    });
    expect(report.coverage.totalCombinations).toBe(12);
    expect(report.coverage.sourceBackedCombinations).toBe(12);
    expect(report.coverage.importedManifestCombinations).toBe(0);
    expect(report.coverage.moeApprovedCombinations).toBeNull();
    expect(report.cells.find((cell) => cell.grade === 1 && cell.subject === "MATH")?.reviewQueue.reason)
      .toMatch(/source provenance metadata/);
  });
});
