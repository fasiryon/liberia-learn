// __tests__/notifications.guardianDigest.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mostRecentWeekWindow } from "@/lib/notifications/guardianDigest";

// ── Template tests ──────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { renderGuardianTemplate } from "@/lib/guardian/sms-templates";

describe("weekly_digest template", () => {
  it("renders with specific actionTip and stays ≤160 chars", () => {
    const text = renderGuardianTemplate("weekly_digest", {
      studentName: "Pewu",
      lessonsCompleted: "4",
      avgScore: "82",
      actionTip: 'Try: review "Understanding Fractions" this weekend.',
    });
    expect(text).toContain("Pewu");
    expect(text).toContain("4");
    expect(text).toContain("82%");
    expect(text).toContain("Understanding Fractions");
    expect(text).toContain("STOP");
    expect(text.length).toBeLessThanOrEqual(160);
  });

  it("renders without actionTip, uses 'Keep it up!' fallback", () => {
    const text = renderGuardianTemplate("weekly_digest", {
      studentName: "Amara",
      lessonsCompleted: "2",
      avgScore: "71",
    });
    expect(text).toContain("Keep it up!");
    expect(text).toContain("STOP");
    expect(text.length).toBeLessThanOrEqual(160);
  });

  it("slices to 160 chars when actionTip is very long", () => {
    const text = renderGuardianTemplate("weekly_digest", {
      studentName: "Josephine Kollie-Johnson",
      lessonsCompleted: "10",
      avgScore: "95",
      actionTip: "Try: review the very very very very very very very very very very very long lesson title this weekend.",
    });
    expect(text.length).toBeLessThanOrEqual(160);
  });
});

// ── mostRecentWeekWindow tests ───────────────────────────────────────────────

describe("mostRecentWeekWindow", () => {
  it("returns Mon–Fri when called on a Saturday", () => {
    // 2026-06-06 is a Saturday
    const { weekStart, weekEnd } = mostRecentWeekWindow(new Date("2026-06-06T12:00:00Z"));
    // weekEnd should be Friday 2026-06-05
    expect(weekEnd.toISOString().slice(0, 10)).toBe("2026-06-05");
    // weekStart should be Monday 2026-06-01
    expect(weekStart.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("returns Mon–Fri for the prior week when called mid-week", () => {
    // 2026-06-03 is a Wednesday — most recent Friday is 2026-05-29
    const { weekStart, weekEnd } = mostRecentWeekWindow(new Date("2026-06-03T12:00:00Z"));
    expect(weekEnd.toISOString().slice(0, 10)).toBe("2026-05-29");
    expect(weekStart.toISOString().slice(0, 10)).toBe("2026-05-25");
  });
});

// ── composeGuardianDigest tests ──────────────────────────────────────────────

const mockUser = vi.hoisted(() => vi.fn());
const mockConsent = vi.hoisted(() => vi.fn());
const mockProgress = vi.hoisted(() => vi.fn());
const mockHwSub = vi.hoisted(() => vi.fn());
const mockGradedSub = vi.hoisted(() => vi.fn());
const mockStuck = vi.hoisted(() => vi.fn());
const mockSW = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mockUser },
    guardianConsent: { findMany: mockConsent },
    studentProgress: { findMany: mockProgress },
    homeworkSubmission: { findMany: mockHwSub },
    gradedSubmission: { findMany: mockGradedSub },
    stuckEvent: { findMany: mockStuck },
    scheduledWork: { findUnique: mockSW },
  },
}));

import { composeGuardianDigest } from "@/lib/notifications/guardianDigest";

const WEEK_START = new Date("2026-06-01T00:00:00Z");
const WEEK_END = new Date("2026-06-05T23:59:59Z");

const BASE_GUARDIAN = {
  smsOptIn: true,
  preferredChannel: "SMS",
  guardianSmsPreferences: null,
  guardianOf: [
    {
      studentId: "stu-1",
      student: { user: { name: "Pewu Kollie", schoolId: "school-cha" } },
    },
  ],
};

beforeEach(() => {
  mockUser.mockReset();
  mockConsent.mockReset();
  mockProgress.mockReset();
  mockHwSub.mockReset();
  mockGradedSub.mockReset();
  mockStuck.mockReset();
  mockSW.mockReset();
});

describe("composeGuardianDigest", () => {
  it("returns null when guardian not found", async () => {
    mockUser.mockResolvedValue(null);
    const r = await composeGuardianDigest({ guardianId: "g-1", studentIds: ["s-1"], weekStart: WEEK_START, weekEnd: WEEK_END });
    expect(r).toBeNull();
  });

  it("returns null when smsOptIn is false", async () => {
    mockUser.mockResolvedValue({ ...BASE_GUARDIAN, smsOptIn: false });
    const r = await composeGuardianDigest({ guardianId: "g-1", studentIds: ["stu-1"], weekStart: WEEK_START, weekEnd: WEEK_END });
    expect(r).toBeNull();
  });

  it("returns null when weeklyDigest preference is false", async () => {
    mockUser.mockResolvedValue({ ...BASE_GUARDIAN, guardianSmsPreferences: { weeklyDigest: false } });
    const r = await composeGuardianDigest({ guardianId: "g-1", studentIds: ["stu-1"], weekStart: WEEK_START, weekEnd: WEEK_END });
    expect(r).toBeNull();
  });

  it("returns null when no lessons completed that week", async () => {
    mockUser.mockResolvedValue(BASE_GUARDIAN);
    mockConsent.mockResolvedValue([]);
    mockProgress.mockResolvedValue([]);
    const r = await composeGuardianDigest({ guardianId: "g-1", studentIds: ["stu-1"], weekStart: WEEK_START, weekEnd: WEEK_END });
    expect(r).toBeNull();
  });

  it("returns digest with action tip referencing stuck lesson", async () => {
    mockUser.mockResolvedValue(BASE_GUARDIAN);
    mockConsent.mockResolvedValue([]);
    mockProgress.mockResolvedValue([
      { studentId: "stu-1", scheduledWork: { id: "sw-1", content: { subject: "MATH", title: "Understanding Fractions" } } },
      { studentId: "stu-1", scheduledWork: { id: "sw-2", content: { subject: "SCIENCE", title: "Food Chains" } } },
    ]);
    mockHwSub.mockResolvedValue([{ aiScore: 0.82 }]);
    mockGradedSub.mockResolvedValue([]);
    mockStuck.mockResolvedValue([
      { lessonId: "sw-stuck-1", signal: "wrong_answers" },
      { lessonId: "sw-stuck-1", signal: "wrong_answers" },
    ]);
    mockSW.mockResolvedValue({ content: { title: "Understanding Fractions in Everyday Life", subject: "MATH" } });

    const r = await composeGuardianDigest({ guardianId: "g-1", studentIds: ["stu-1"], weekStart: WEEK_START, weekEnd: WEEK_END });

    expect(r).not.toBeNull();
    expect(r!.metrics.lessonsCompleted).toBe(2);
    expect(r!.metrics.avgScore).toBe(82);
    expect(r!.metrics.strongestSubject).toBe("MATH");
    expect(r!.metrics.stuckLessonTitle).toContain("Understanding Fractions");
    expect(r!.smsText).toContain("Pewu");
    expect(r!.smsText).toContain("STOP");
    expect(r!.smsText.length).toBeLessThanOrEqual(160);
  });

  it("SMS text always fits within 160 chars", async () => {
    mockUser.mockResolvedValue({
      ...BASE_GUARDIAN,
      guardianOf: [{ studentId: "stu-1", student: { user: { name: "Josephine-Beatrice Kollie-Morrison-Johnson", schoolId: "school-cha" } } }],
    });
    mockConsent.mockResolvedValue([]);
    mockProgress.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        studentId: "stu-1",
        scheduledWork: { id: `sw-${i}`, content: { subject: "MATH", title: `Math Lesson ${i}` } },
      }))
    );
    mockHwSub.mockResolvedValue([]);
    mockGradedSub.mockResolvedValue([]);
    mockStuck.mockResolvedValue([{ lessonId: "sw-stuck", signal: "slow_response" }]);
    mockSW.mockResolvedValue({
      content: {
        title: "An Extremely Long Lesson Title That Goes Way Beyond What Fits In An SMS Message Body Comfortably",
        subject: "MATH",
      },
    });

    const r = await composeGuardianDigest({ guardianId: "g-1", studentIds: ["stu-1"], weekStart: WEEK_START, weekEnd: WEEK_END });
    expect(r).not.toBeNull();
    expect(r!.smsText.length).toBeLessThanOrEqual(160);
  });
});
