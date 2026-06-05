import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  currentWeekWindow,
  previousWeekWindow,
  assignDistrictRanks,
  type SchoolWeekScore,
} from "@/lib/league/weeklyScore";

describe("currentWeekWindow", () => {
  it("returns a Monday–Monday window", () => {
    const { weekStart, weekEnd } = currentWeekWindow();
    expect(weekStart.getUTCDay()).toBe(1);
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("weekStart is at midnight UTC", () => {
    const { weekStart } = currentWeekWindow();
    expect(weekStart.getUTCHours()).toBe(0);
    expect(weekStart.getUTCMinutes()).toBe(0);
    expect(weekStart.getUTCSeconds()).toBe(0);
  });
});

describe("previousWeekWindow", () => {
  it("ends where current week starts", () => {
    const prev = previousWeekWindow();
    const curr = currentWeekWindow();
    expect(prev.weekEnd.getTime()).toBe(curr.weekStart.getTime());
  });
});

describe("assignDistrictRanks", () => {
  function makeScore(schoolId: string, district: string, score: number): SchoolWeekScore {
    return { schoolId, schoolName: `School ${schoolId}`, district, score, pointsTotal: score * 10, enrollmentCount: 50 };
  }

  it("assigns rank 1 to highest score in district", () => {
    const scores = [
      makeScore("s1", "Greater Monrovia", 8),
      makeScore("s2", "Greater Monrovia", 12),
      makeScore("s3", "Greater Monrovia", 5),
    ];
    const ranked = assignDistrictRanks(scores);
    const s2 = ranked.find((r) => r.schoolId === "s2")!;
    expect(s2.rank).toBe(1);
  });

  it("ranks are per-district not global", () => {
    const scores = [
      makeScore("s1", "Greater Monrovia", 20),
      makeScore("s2", "Bong", 5),
      makeScore("s3", "Bong", 8),
    ];
    const ranked = assignDistrictRanks(scores);
    const s1 = ranked.find((r) => r.schoolId === "s1")!;
    const s2 = ranked.find((r) => r.schoolId === "s2")!;
    const s3 = ranked.find((r) => r.schoolId === "s3")!;
    expect(s1.rank).toBe(1);
    expect(s3.rank).toBe(1); // top in Bong
    expect(s2.rank).toBe(2);
  });

  it("handles single school per district", () => {
    const scores = [makeScore("s1", "Solo District", 7)];
    const ranked = assignDistrictRanks(scores);
    expect(ranked[0].rank).toBe(1);
  });

  it("handles empty input", () => {
    expect(assignDistrictRanks([])).toEqual([]);
  });

  it("ties assign the same rank based on sort position (no tie-breaking)", () => {
    const scores = [
      makeScore("s1", "D", 10),
      makeScore("s2", "D", 10),
    ];
    const ranked = assignDistrictRanks(scores);
    const ranks = ranked.map((r) => r.rank).sort();
    expect(ranks).toEqual([1, 2]);
  });
});
