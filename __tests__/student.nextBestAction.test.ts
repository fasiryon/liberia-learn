import { describe, expect, it } from "vitest";
import {
  scoreRevisitPrerequisite,
  scoreOverdue,
  scoreCriticalMastery,
  scoreScheduledToday,
  scoreWaecPractice,
  scoreRetryAssessment,
  scoreReview,
  CONTINUE_PRIORITY,
  ADVANCE_PRIORITY,
  rankNextBestActions,
  type NextActionCandidate,
} from "@/lib/student/nextBestAction";

function candidate(overrides: Partial<NextActionCandidate> = {}): NextActionCandidate {
  return {
    type: "REVIEW",
    priority: 40,
    label: "Review",
    reason: "reason",
    href: "/student/lessons/x",
    subject: "MATH",
    masteryPercent: null,
    lastSignalAt: null,
    ...overrides,
  };
}

describe("nextBestAction scoring formulas", () => {
  it("scoreRevisitPrerequisite ranges 85-95, worse average scores higher", () => {
    expect(scoreRevisitPrerequisite(65)).toBe(85);
    expect(scoreRevisitPrerequisite(64)).toBeCloseTo(85.15, 1);
    expect(scoreRevisitPrerequisite(0)).toBe(95);
    expect(scoreRevisitPrerequisite(55)).toBeCloseTo(86.5, 1);
  });

  it("scoreOverdue caps at 80, reached at 5 days", () => {
    expect(scoreOverdue(0)).toBe(50);
    expect(scoreOverdue(1)).toBe(56);
    expect(scoreOverdue(5)).toBe(80);
    expect(scoreOverdue(6)).toBe(80);
    expect(scoreOverdue(60)).toBe(80);
  });

  it("overdue never reaches the persistent-prerequisite-failure floor", () => {
    const maxOverdue = scoreOverdue(999);
    const minPrerequisiteFailure = scoreRevisitPrerequisite(65);
    expect(maxOverdue).toBeLessThan(minPrerequisiteFailure);
  });

  it("scoreCriticalMastery ranges 60-80, lower scores rank higher", () => {
    expect(scoreCriticalMastery(40)).toBe(60);
    expect(scoreCriticalMastery(0)).toBe(80);
    expect(scoreCriticalMastery(20)).toBe(70);
  });

  it("scoreScheduledToday: current period beats a routine slot", () => {
    expect(scoreScheduledToday(true)).toBe(70);
    expect(scoreScheduledToday(false)).toBe(55);
  });

  it("scoreWaecPractice: mild gaps stay non-urgent, severe gaps become competitive", () => {
    expect(scoreWaecPractice(75)).toBe(40);
    expect(scoreWaecPractice(70)).toBeCloseTo(42.7, 1);
    expect(scoreWaecPractice(0)).toBe(80);
    expect(scoreWaecPractice(30)).toBe(64);
  });

  it("scoreRetryAssessment ranges 50-65", () => {
    expect(scoreRetryAssessment(60)).toBe(50);
    expect(scoreRetryAssessment(0)).toBe(65);
  });

  it("scoreReview ranges 35-45", () => {
    expect(scoreReview(74)).toBe(35);
    expect(scoreReview(60)).toBe(45);
  });

  it("continue/advance are flat, lower than every graded category", () => {
    expect(CONTINUE_PRIORITY).toBe(30);
    expect(ADVANCE_PRIORITY).toBe(20);
    expect(CONTINUE_PRIORITY).toBeLessThan(scoreReview(74));
  });
});

describe("rankNextBestActions", () => {
  it("returns null hero and null waecSecondary for no candidates", () => {
    const result = rankNextBestActions([]);
    expect(result.hero).toBeNull();
    expect(result.waecSecondary).toBeNull();
    expect(result.ranked).toEqual([]);
  });

  it("dedupes by href, keeping the first occurrence", () => {
    const a = candidate({ href: "/x", priority: 90, label: "first" });
    const b = candidate({ href: "/x", priority: 10, label: "second" });
    const result = rankNextBestActions([a, b]);
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].label).toBe("first");
  });

  it("ties break on lowest mastery percent, then most recent signal", () => {
    const older = candidate({ href: "/a", priority: 50, masteryPercent: 40, lastSignalAt: "2026-01-01T00:00:00.000Z" });
    const worseButOlder = candidate({ href: "/b", priority: 50, masteryPercent: 20, lastSignalAt: "2025-01-01T00:00:00.000Z" });
    const result = rankNextBestActions([older, worseButOlder]);
    expect(result.hero?.href).toBe("/b"); // lower mastery wins the tie
  });

  // Escalation Case 1: WAEC-track student at 70% readiness in their weakest
  // subject, with one ordinary overdue assignment (2 days) and one routine
  // today's-scheduled item also present.
  it("Case 1: a mild (70%) WAEC gap loses the hero slot to routine signals but still gets a guaranteed secondary slot", () => {
    const waec = candidate({
      type: "WAEC_PRACTICE",
      href: "/student/waec/literature/practice",
      priority: scoreWaecPractice(70),
      subject: "LITERATURE",
    });
    const overdue = candidate({
      type: "OVERDUE",
      href: "/student/assignments/a1",
      priority: scoreOverdue(2),
      subject: "MATH",
    });
    const scheduled = candidate({
      type: "SCHEDULED_TODAY",
      href: "/student/lessons/today-lesson",
      priority: scoreScheduledToday(false),
      subject: "SCIENCE",
    });

    const result = rankNextBestActions([waec, overdue, scheduled]);

    expect(result.hero?.type).toBe("OVERDUE");
    expect(result.hero?.priority).toBe(62);
    expect(result.waecSecondary).not.toBeNull();
    expect(result.waecSecondary?.type).toBe("WAEC_PRACTICE");
  });

  // Escalation Case 2: a 6+ day overdue assignment AND a genuine persistent
  // prerequisite failure present simultaneously.
  it("Case 2: a persistent prerequisite failure clearly outranks a 6-day-overdue assignment", () => {
    const overdue = candidate({
      type: "OVERDUE",
      href: "/student/assignments/a2",
      priority: scoreOverdue(6),
    });
    const prerequisiteFailure = candidate({
      type: "REVISIT_PREREQUISITE",
      href: "/student/lessons/prereq-lesson",
      priority: scoreRevisitPrerequisite(55),
      masteryPercent: 55,
    });

    const result = rankNextBestActions([overdue, prerequisiteFailure]);

    expect(result.hero?.type).toBe("REVISIT_PREREQUISITE");
    expect(result.hero!.priority - overdue.priority).toBeGreaterThan(5); // clear margin, not a coin flip
  });

  it("a severe WAEC gap (readiness near 0) can win the hero slot outright, same as any other category", () => {
    const waec = candidate({
      type: "WAEC_PRACTICE",
      href: "/student/waec/chemistry/practice",
      priority: scoreWaecPractice(5),
    });
    const scheduled = candidate({
      type: "SCHEDULED_TODAY",
      href: "/student/lessons/today-lesson",
      priority: scoreScheduledToday(false),
    });

    const result = rankNextBestActions([waec, scheduled]);
    expect(result.hero?.type).toBe("WAEC_PRACTICE");
    expect(result.waecSecondary).toBeNull(); // already the hero, no duplicate card
  });

  it("student behind on mastery: critical alert beats ordinary review and a routine scheduled item", () => {
    const critical = candidate({ type: "CRITICAL_MASTERY", href: "/c", priority: scoreCriticalMastery(15) });
    const review = candidate({ type: "REVIEW", href: "/r", priority: scoreReview(68) });
    const scheduled = candidate({ type: "SCHEDULED_TODAY", href: "/s", priority: scoreScheduledToday(false) });
    const result = rankNextBestActions([critical, review, scheduled]);
    expect(result.hero?.type).toBe("CRITICAL_MASTERY");
  });

  it("student ahead of pace, nothing in progress: advance is the only candidate and wins", () => {
    const advance = candidate({ type: "ADVANCE", href: "/adv", priority: ADVANCE_PRIORITY });
    const result = rankNextBestActions([advance]);
    expect(result.hero?.type).toBe("ADVANCE");
  });

  it("continue (in-progress momentum) outranks advance (a fresh lesson) when both are candidates", () => {
    const advance = candidate({ type: "ADVANCE", href: "/adv", priority: ADVANCE_PRIORITY });
    const cont = candidate({ type: "CONTINUE", href: "/cont", priority: CONTINUE_PRIORITY });
    const result = rankNextBestActions([advance, cont]);
    expect(result.hero?.type).toBe("CONTINUE");
  });

  it("nothing overdue, on-track day: today's current-period item wins over a non-urgent WAEC nudge", () => {
    const currentPeriod = candidate({ type: "SCHEDULED_TODAY", href: "/period", priority: scoreScheduledToday(true) });
    const waec = candidate({ type: "WAEC_PRACTICE", href: "/waec", priority: scoreWaecPractice(72) });
    const result = rankNextBestActions([currentPeriod, waec]);
    expect(result.hero?.type).toBe("SCHEDULED_TODAY");
    expect(result.waecSecondary?.type).toBe("WAEC_PRACTICE");
  });
});
