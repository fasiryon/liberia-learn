// B1/B2 (T1-SCHOOL-DAY-READINESS-20261103): a finished pilot lesson returns to the school day and opens the NEXT admitted
// period; leaving mid-lesson reopens the same period. Return parameters are honoured only for selections the authenticated
// student's own resolved day admitted. No stored state, no record writes, no completion claims.
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PilotDay, PilotDayPeriod } from "@/lib/curriculum/v4/pilotDay";
import { returnBlock, schoolDayFromPilot } from "@/lib/learner-experience/day/pilotSchoolDay";

const mocks = vi.hoisted(() => ({ enabled: true, resolve: vi.fn(), requireRole: vi.fn(), notFound: vi.fn(() => { throw Error("NEXT_NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/cache", () => ({ unstable_noStore: () => undefined }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/curriculum/v4/learningPreview", () => ({ isLearningPreviewEnabled: () => mocks.enabled }));
vi.mock("@/lib/curriculum/v4/pilotDay", () => ({ resolvePilotDay: mocks.resolve }));

const sel = (n: number) => `factory@4.0.0-schoolday-test.${n}@g4-lesson-${n}`;
const period = (n: number): PilotDayPeriod => ({ timetableId: `t${n}`, classId: "c4", subject: "MATH", periodLabel: `Period ${n}`,
  startTime: `0${7 + n}:00`.slice(-5), endTime: `0${7 + n}:35`.slice(-5), status: "ADMITTED", selection: sel(n), packageHash: String(n).repeat(64).slice(0, 64),
  href: `/learn/preview/${encodeURIComponent(sel(n))}` });
const gap = (n: number): PilotDayPeriod => ({ timetableId: `t${n}`, classId: "c4", subject: "ENGINEERING", periodLabel: `Period ${n}`, startTime: null, endTime: null, status: "GAP", reason: "UNBOUND" });
const pilot = (periods: PilotDayPeriod[]): PilotDay => ({ date: "2026-11-03", status: "PILOT_ONLY", canonicalRecordWrites: false, periods });

describe("returnBlock: which period opens on return to the day", () => {
  const { day, lessons } = schoolDayFromPilot(pilot([period(1), period(2), gap(3), period(4)]), null);
  it("after a finished lesson opens the next admitted lesson period, skipping gaps", () => {
    expect(returnBlock(day, lessons, { after: sel(1) })).toMatchObject({ slot: "P2", announcement: expect.stringContaining("Next") });
    expect(returnBlock(day, lessons, { after: sel(2) })).toMatchObject({ slot: "P4" });
  });
  it("after the last lesson stays on it and says the day's lessons are done", () => {
    expect(returnBlock(day, lessons, { after: sel(4) })).toMatchObject({ slot: "P4", announcement: expect.stringMatching(/last/i) });
  });
  it("leaving mid-lesson (at) reopens the same period", () => {
    expect(returnBlock(day, lessons, { at: sel(2) })).toMatchObject({ slot: "P2" });
  });
  it.each([
    ["unknown selection", { after: "factory@9.9.9@not-admitted" }],
    ["array parameter", { after: [sel(1), sel(2)] }],
    ["over-long value", { after: "x".repeat(400) }],
    ["empty", { after: "" }],
    ["absent", {}],
  ])("ignores %s (no fallback guess)", (_label, params) => expect(returnBlock(day, lessons, params as never)).toBeNull());
});

describe("/learn/day honours only admitted return selections", () => {
  beforeEach(() => { mocks.enabled = true; mocks.resolve.mockReset(); mocks.requireRole.mockReset().mockResolvedValue({ id: "s1", role: "STUDENT", schoolId: "sch" }); });
  const page = async (searchParams?: Record<string, string | string[] | undefined>) => (await import("@/app/learn/day/page")).default({ searchParams });

  it("opens the next period after a finished lesson", async () => {
    mocks.resolve.mockResolvedValueOnce(pilot([period(1), period(2), period(3)]));
    const html = renderToStaticMarkup(await page({ after: sel(1) }));
    expect(html).toContain('data-day-detail="P2"');
    expect(html).toContain("Next:");
  });
  it("a selection from another student's or school's day cannot steer the page", async () => {
    mocks.resolve.mockResolvedValueOnce(pilot([period(1), period(2)]));
    const html = renderToStaticMarkup(await page({ after: "factory@4.0.0@foreign-school-lesson" }));
    expect(html).not.toContain('data-day-detail="P2"');
  });
  it("still 404s with a return parameter when the resolver conceals the day", async () => {
    mocks.resolve.mockResolvedValueOnce(null);
    await expect(page({ after: sel(1) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the pilot player links back into the school day", () => {
  const src = fs.readFileSync("components/learner-experience/LearningPreviewPlayer.tsx", "utf8");
  it("Finish returns to /learn/day?after=<selection> and Leave to /learn/day?at=<selection>", () => {
    expect(src).toMatch(/finishHref=\{`\/learn\/day\?after=\$\{encodeURIComponent\(selection\)\}`\}/);
    expect(src).toMatch(/exitHref=\{`\/learn\/day\?at=\$\{encodeURIComponent\(selection\)\}`\}/);
    expect(src).not.toContain('exitHref="/student/lessons"');
  });
  it("the finished panel labels the pilot return 'Back to my school day' and still claims nothing was saved", () => {
    const player = fs.readFileSync("components/learner-experience/LessonPlayerV2.tsx", "utf8");
    expect(player).toContain("Back to my school day");
    expect(player).toContain("Nothing was saved, submitted or graded.");
  });
});
