import { describe, expect, it } from "vitest";
import {
  completedScoreLabel,
  filterSubmissionsForTenant,
  isNewSubmission,
  sortSubmissionsNewestFirst,
} from "@/lib/assignments/pollingPresentation";

describe("teacher submission feed polling presentation", () => {
  it("sorts teacher submissions by submittedAt descending", () => {
    const rows = sortSubmissionsNewestFirst([
      { id: "old", submittedAt: "2026-04-28T10:00:00.000Z", score: null, points: 100 },
      { id: "new", submittedAt: "2026-04-28T10:05:00.000Z", score: null, points: 100 },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["new", "old"]);
  });

  it("shows New for submissions within 10 minutes", () => {
    const now = new Date("2026-04-28T10:10:00.000Z");

    expect(isNewSubmission("2026-04-28T10:01:00.000Z", now)).toBe(true);
    expect(isNewSubmission("2026-04-28T09:59:00.000Z", now)).toBe(false);
  });

  it("shows score for completed submissions", () => {
    expect(completedScoreLabel({ score: 87, points: 100 })).toBe("Score 87/100");
    expect(completedScoreLabel({ score: null, points: 100 })).toBeNull();
  });

  it("keeps tenant scoping for teacher-visible submissions", () => {
    const rows = filterSubmissionsForTenant(
      [
        { id: "own", submittedAt: null, score: null, points: 100, schoolId: "school-a" },
        { id: "other", submittedAt: null, score: null, points: 100, schoolId: "school-b" },
      ],
      "school-a"
    );

    expect(rows.map((row) => row.id)).toEqual(["own"]);
  });
});
