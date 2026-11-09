// /learn/day: T2's resolvePilotDay is the only source of periods and links; the CoS resolved day adds planning context
// only on an exact (selection, packageHash) match; gaps show the program label; any failure is a 404.
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PilotDay, PilotDayPeriod } from "@/lib/curriculum/v4/pilotDay";
import { GRADES } from "@/lib/learner-experience/day/schoolDay";
import { schoolDayForGrade } from "@/lib/learner-experience/day/loadSchoolDay";
import { cosDayForPilot, PILOT_LESSON_LABEL, PROGRAM_GAP_LABEL, schoolDayFromPilot } from "@/lib/learner-experience/day/pilotSchoolDay";

const mocks = vi.hoisted(() => ({ enabled: true, resolve: vi.fn(), requireRole: vi.fn(), notFound: vi.fn(() => { throw Error("NEXT_NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/cache", () => ({ unstable_noStore: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/curriculum/v4/learningPreview", () => ({ isLearningPreviewEnabled: () => mocks.enabled }));
vi.mock("@/lib/curriculum/v4/pilotDay", () => ({ resolvePilotDay: mocks.resolve }));

const cos = GRADES.map(schoolDayForGrade);
const g7 = cos[7];
const g7Lesson = (slot: string) => { const b = g7.blocks.find((x) => x.slot === slot)!.binding; if (b.kind !== "LESSON") throw Error("not a lesson"); return b; };
const admitted = (slot: string, timetableId: string, startTime: string | null = "08:00"): PilotDayPeriod => {
  const b = g7Lesson(slot);
  return { timetableId, classId: "c7", subject: "MATH", periodLabel: `Period ${slot.slice(1)}`, startTime, endTime: startTime ? "08:45" : null,
    status: "ADMITTED", selection: b.selection, packageHash: b.packageHash, href: `/learn/preview/${encodeURIComponent(b.selection)}` };
};
const gap = (timetableId: string, reason: "UNBOUND" | "AMBIGUOUS_BINDING" | "NOT_ADMITTED" = "UNBOUND"): PilotDayPeriod =>
  ({ timetableId, classId: "c7", subject: "ENGINEERING", periodLabel: "Period 6", startTime: "13:00", endTime: "13:45", status: "GAP", reason });
const pilot = (periods: PilotDayPeriod[]): PilotDay => ({ date: "2026-10-26", status: "PILOT_ONLY", canonicalRecordWrites: false, periods });

describe("planning context only on an exact CoS match", () => {
  it("matches the one resolved day binding every admitted selection and hash", () => {
    expect(cosDayForPilot(pilot([admitted("P1", "t1"), admitted("P2", "t2"), gap("t6")]), cos)?.grade).toBe(7);
  });
  it("gives no context for a different hash, no admitted period, or more than one matching day", () => {
    const tampered = { ...admitted("P1", "t1"), packageHash: "0".repeat(64) } as PilotDayPeriod;
    expect(cosDayForPilot(pilot([tampered]), cos)).toBeNull();
    expect(cosDayForPilot(pilot([gap("t6")]), cos)).toBeNull();
    expect(cosDayForPilot(pilot([admitted("P1", "t1")]), [g7, g7])).toBeNull();
  });
});

describe("the pilot day as a school day", () => {
  it("keeps the resolver's periods, times and hrefs, and the CoS lesson context", () => {
    const p = pilot([admitted("P1", "t1"), gap("t6", "NOT_ADMITTED")]);
    const { day, lessons } = schoolDayFromPilot(p, cosDayForPilot(p, cos));
    expect(day).toMatchObject({ source: "PILOT_TIMETABLE", grade: 7, gradeLabel: "7", band: "G6_8" });
    expect(day.blocks.map((b) => [b.label, b.start, b.end])).toEqual([["Period 1", "08:00", "08:45"], ["Period 6", "13:00", "13:45"]]);
    const [lesson, hole] = day.blocks;
    expect(lesson.binding).toEqual(g7Lesson("P1"));
    expect(lesson.segments).toEqual(g7.blocks.find((b) => b.slot === "P1")!.segments);
    expect(lessons[lesson.id]).toEqual({ href: "/learn/preview/factory%404.0.0-draft.6%40g7-math-fractions", unavailable: null });
    expect(hole.binding).toEqual({ kind: "GAP", label: PROGRAM_GAP_LABEL, teacherLed: null, order: null });
    expect(lessons[hole.id]).toBeUndefined();
  });
  it("the gap label is the CoS resolved studentLabel of every teaching-period gap", () => {
    const labels = cos.flatMap((d) => d.blocks).flatMap((b) => (b.kind === "PERIOD" && b.binding.kind === "GAP" ? [b.binding.label] : []));
    expect(labels.length).toBeGreaterThan(0);
    expect(new Set(labels)).toEqual(new Set([PROGRAM_GAP_LABEL]));
  });
  it("without a match it shows the bare pilot label, no grade and no invented segments", () => {
    const p = pilot([{ ...admitted("P1", "t1", null), packageHash: "a".repeat(64) } as PilotDayPeriod]);
    const { day, lessons } = schoolDayFromPilot(p, cosDayForPilot(p, cos));
    expect(day).toMatchObject({ grade: null, gradeLabel: "", section: "" });
    expect(day.blocks[0]).toMatchObject({ start: "", end: "", unit: null, segments: [], stage: null, binding: { kind: "LESSON", studentLabel: PILOT_LESSON_LABEL, title: null } });
    expect(lessons[day.blocks[0].id].href).toMatch(/^\/learn\/preview\//);
  });
});

describe("/learn/day route", () => {
  beforeEach(() => { mocks.enabled = true; mocks.resolve.mockReset(); mocks.requireRole.mockReset().mockResolvedValue({ id: "s1", role: "STUDENT", schoolId: "sch" }); });
  const page = async () => (await import("@/app/learn/day/page")).default();

  it("404s when the preview gate is off, without resolving", async () => {
    mocks.enabled = false;
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("404s when the resolver conceals the day, throws, or auth fails", async () => {
    mocks.resolve.mockResolvedValueOnce(null);
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.resolve.mockRejectedValueOnce(Error("db down"));
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.requireRole.mockRejectedValueOnce(Error("unauthorized"));
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("renders the journey with only the resolver's links", async () => {
    mocks.resolve.mockResolvedValueOnce(pilot([admitted("P1", "t1"), gap("t6")]));
    const html = renderToStaticMarkup(await page());
    expect(html).toContain('data-day-source="PILOT_TIMETABLE"');
    expect(html).toContain("Your teacher records attendance.");
    expect(html).toContain("Period 1");
    expect(html).not.toContain("/lab-review");
  });
  it("says so plainly when the timetable has no periods today", async () => {
    mocks.resolve.mockResolvedValueOnce(pilot([]));
    expect(renderToStaticMarkup(await page())).toContain("There are no classes on your timetable today.");
  });
  it("adds no resolver, loader or record writer of its own", () => {
    const src = ["app/learn/day/page.tsx", "lib/learner-experience/day/pilotSchoolDay.ts"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/\.timetable\.|findMany|loadStudentLearningPreview|\.create\(|\.update\(|\.upsert\(/);
  });
});
