import { describe, expect, it } from "vitest";
import { listCoverageEntries } from "@/lib/curriculum/fullCoverageCatalog";

describe("Computer Science curriculum coverage", () => {
  it("covers grades 7 through 12 with at least 100 targeted lessons", () => {
    const entries = listCoverageEntries({ subject: "COMPUTER_SCIENCE" });
    const grades = entries.map((entry) => entry.grade).sort((left, right) => left - right);
    const totalLessonTarget = entries.reduce((sum, entry) => sum + entry.totalLessonTarget, 0);

    expect(grades).toEqual([7, 8, 9, 10, 11, 12]);
    expect(totalLessonTarget).toBeGreaterThanOrEqual(100);
  });
});
