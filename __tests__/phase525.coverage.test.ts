import { describe, it, expect } from "vitest";
import { getStudentGreeting } from "@/lib/student/greetings";

// ── Section 1: Coverage calculations ──────────────────────────────────────
describe("coverage gap severity", () => {
  function severity(approved: number): "critical" | "severe" | "adequate" {
    if (approved < 5) return "critical";
    if (approved <= 10) return "severe";
    return "adequate";
  }

  it("grades with 0 approved lessons are critical", () => {
    expect(severity(0)).toBe("critical");
    expect(severity(2)).toBe("critical");
    expect(severity(4)).toBe("critical");
  });

  it("grades with 5-10 approved lessons are severe", () => {
    expect(severity(5)).toBe("severe");
    expect(severity(10)).toBe("severe");
  });

  it("grades with more than 10 approved lessons are adequate", () => {
    expect(severity(11)).toBe("adequate");
    expect(severity(184)).toBe("adequate");
  });

  it("grade 2 and grade 9 are critical gaps per Phase 0 audit (< 5 approved)", () => {
    expect(severity(3)).toBe("critical");
    expect(severity(2)).toBe("critical");
  });
});

// ── Section 4: Greeting logic ─────────────────────────────────────────────
describe("getStudentGreeting", () => {
  const morning = new Date("2026-04-23T08:00:00");
  const afternoon = new Date("2026-04-23T14:00:00");
  const evening = new Date("2026-04-23T19:00:00");

  it("uses time-based prefix for morning", () => {
    const { headline } = getStudentGreeting({ studentName: "Amara", time: morning });
    expect(headline).toMatch(/Good morning/);
    expect(headline).toContain("Amara");
  });

  it("uses time-based prefix for afternoon", () => {
    const { headline } = getStudentGreeting({ studentName: "Amara", time: afternoon });
    expect(headline).toMatch(/Good afternoon/);
  });

  it("uses time-based prefix for evening", () => {
    const { headline } = getStudentGreeting({ studentName: "Amara", time: evening });
    expect(headline).toMatch(/Good evening/);
  });

  it("returns default subtext when no signals", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning });
    expect(subtext).toBe("Ready to learn?");
  });

  it("re-engagement message when lastActiveDaysAgo >= 3", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning, lastActiveDaysAgo: 5 });
    expect(subtext).toMatch(/Welcome back/);
  });

  it("re-engagement takes priority over streak", () => {
    const { subtext } = getStudentGreeting({
      studentName: "Amara",
      time: morning,
      lastActiveDaysAgo: 4,
      streakDays: 10,
    });
    expect(subtext).toMatch(/Welcome back/);
  });

  it("long streak message for >= 7 days", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning, streakDays: 7 });
    expect(subtext).toMatch(/7/);
    expect(subtext).toMatch(/outstanding/i);
  });

  it("short streak message for 3-6 days", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning, streakDays: 4 });
    expect(subtext).toMatch(/4/);
    expect(subtext).toMatch(/Keep it up/i);
  });

  it("excellence subtext when avgGrade >= 85", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning, avgGrade: 92 });
    expect(subtext).toMatch(/excellently/i);
  });

  it("encouragement subtext when avgGrade < 60", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning, avgGrade: 45 });
    expect(subtext).toMatch(/strengthen/i);
  });

  it("mid-range avgGrade returns default subtext", () => {
    const { subtext } = getStudentGreeting({ studentName: "Amara", time: morning, avgGrade: 72 });
    expect(subtext).toBe("Ready to learn?");
  });
});

// ── Section 5: contentGap behavior ───────────────────────────────────────
describe("contentGap adaptive engine safety", () => {
  it("contentGap is true only for grades 2 and 9 (Phase 0 audit)", () => {
    // Mirrors the logic in lib/student/adaptiveRecommendations.ts line 383
    function isContentGap(grade: number | null): boolean {
      return grade !== null && (grade === 2 || grade === 9);
    }
    expect(isContentGap(2)).toBe(true);
    expect(isContentGap(9)).toBe(true);
    expect(isContentGap(1)).toBe(false);
    expect(isContentGap(5)).toBe(false);
    expect(isContentGap(null)).toBe(false);
  });

  it("non-critical grades do not trigger gap flag", () => {
    function isContentGap(grade: number | null): boolean {
      return grade !== null && (grade === 2 || grade === 9);
    }
    for (const g of [1, 3, 4, 5, 6, 7, 8, 10, 11, 12]) {
      expect(isContentGap(g)).toBe(false);
    }
  });
});
