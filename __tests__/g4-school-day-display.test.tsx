// @vitest-environment jsdom
/**
 * School-day display fixes (CoS COS-ASSIGN-SCHOOL-DAY-DISPLAY-FIXES-20261104; gallery run 41757385167). Presentation
 * only: nothing is sent, saved to a record or claimed as completion.
 *  Fix 1: each Finish -> /learn/day?after=... is a new page load, so the end-of-day count read "1 of 8". The periods
 *         opened in THIS browser session are kept in sessionStorage (keyed by plan + a hash of the signed-in user),
 *         with a memory fallback, and recorded when a lesson is opened or returned from.
 *  Fix 2: pilot periods are not time-gated, so outside the first/last period the Now card says so instead of
 *         "School has not started yet"; a strictly validated ?clock=HH:MM can pin a rehearsal time.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchoolDayJourney } from "@/components/experience/day/SchoolDayJourney";
import { parseRehearsalClock, returnBlock, schoolDayFromPilot } from "@/lib/learner-experience/day/pilotSchoolDay";
import type { PilotDay } from "@/lib/curriculum/v4/pilotDay";
import { daySessionKey } from "@/lib/learner-experience/day/daySessionKey";

const plus35 = (hhmm: string) => { const m = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + 35; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const times = ["08:00", "08:40", "09:20", "10:00", "10:40", "11:20", "12:00", "12:40"];
const pilot: PilotDay = { date: "2026-11-04", status: "PILOT_ONLY", canonicalRecordWrites: false,
  periods: times.map((start, i) => ({ timetableId: `g4-e2e-period-${i + 1}`, classId: "g4-e2e-class", subject: "MATH", periodLabel: `Period ${i + 1}`,
    startTime: start, endTime: plus35(start),
    status: "ADMITTED" as const, selection: `factory@synthetic@lesson-${i + 1}`, packageHash: "a".repeat(64), href: `/learn/preview/lesson-${i + 1}` })) };
const { day, lessons } = schoolDayFromPilot(pilot, null);
const ATT = { status: "NOT_RECORDED", note: "Your teacher records attendance." } as const;
const KEY = `${day.planId}:user-hash-a`;

async function mount(props: Partial<Parameters<typeof SchoolDayJourney>[0]>) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<SchoolDayJourney day={day} lessons={lessons} attendance={ATT} clockAt="10:05" sessionKey={KEY} {...props} />));
  const endDay = async () => {
    const last = day.blocks[day.blocks.length - 1];
    const pick = Array.from(host.querySelectorAll<HTMLButtonElement>("button.ll7-day-slot")).find((b) => b.getAttribute("data-slot") === last.slot)!;
    await act(async () => { pick.click(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("button[data-day-end]")!.click(); });
  };
  return { host, endDay, dispose: async () => { await act(async () => root.unmount()); host.remove(); } };
}
beforeEach(() => { try { window.sessionStorage.clear(); } catch { /* none */ } });
afterEach(() => { vi.restoreAllMocks(); });
const block = (n: number) => day.blocks[n - 1].id;

describe("Fix 1: periods opened in this browser session", () => {
  it("RED: three returns (after P1 -> P2 -> P3) give 'opened 3 of 8' across page loads", async () => {
    for (const n of [1, 2, 3]) {
      const page = await mount({ returnedFromBlockId: block(n), initialBlockId: block(n + 1) });
      await page.dispose();
    }
    const page = await mount({});
    try {
      await page.endDay();
      expect(page.host.textContent).toContain("You opened 3 of 8 periods in this browser session.");
      expect(page.host.textContent).toContain("Your own list is not a record of lessons finished.");
      expect(page.host.textContent).not.toContain("parts of the day");
    } finally { await page.dispose(); }
  });
  it("RED: opening a lesson records that period before navigation", async () => {
    const page = await mount({ initialBlockId: block(5) });
    try {
      const open = page.host.querySelector<HTMLAnchorElement>("a[data-day-open]")!;
      open.addEventListener("click", (event) => event.preventDefault()); // jsdom: no navigation
      await act(async () => { open.click(); });
      await page.endDay();
      expect(page.host.textContent).toContain("You opened 1 of 8 periods in this browser session.");
    } finally { await page.dispose(); }
  });
  it("RED: storage unavailable falls back to memory without crashing", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const page = await mount({ returnedFromBlockId: block(2), initialBlockId: block(3) });
    try {
      await page.endDay();
      expect(page.host.textContent).toContain("You opened 1 of 8 periods in this browser session.");
    } finally { await page.dispose(); }
  });
  it("RED: a different user or plan carries nothing over", async () => {
    await (await mount({ returnedFromBlockId: block(1), initialBlockId: block(2) })).dispose();
    for (const sessionKey of [`${day.planId}:user-hash-b`, `pilot-day:2026-11-05:user-hash-a`]) {
      const page = await mount({ sessionKey });
      try {
        await page.endDay();
        expect(page.host.textContent).toContain("You opened 0 of 8 periods in this browser session.");
      } finally { await page.dispose(); }
    }
  });
  it("RED: returnBlock reports the period returned from (after and at)", () => {
    expect(returnBlock(day, lessons, { after: "factory@synthetic@lesson-1" })).toMatchObject({ blockId: block(2), fromBlockId: block(1) });
    expect(returnBlock(day, lessons, { at: "factory@synthetic@lesson-4" })).toMatchObject({ blockId: block(4), fromBlockId: block(4) });
  });
});

describe("Atlas Phase 2 browser REVISE P2: the end-of-day view survives a reload of the return URL", () => {
  // After a lesson the URL keeps ?after=/?at=, so every mount used to see a "return" and reset ended=false. A reload of
  // that URL is not a new return: the stored end-of-day state must survive it. A fresh return still reopens the day.
  const navigation = (type: "navigate" | "reload") =>
    vi.spyOn(performance, "getEntriesByType").mockImplementation(((kind: string) => (kind === "navigation" ? [{ type }] : [])) as never);
  const summaryShown = (host: HTMLElement) => host.querySelector("[data-day-end-summary]") !== null;

  it("RED: return, end the day, reload the same return URL: the summary and its count remain", async () => {
    navigation("navigate");
    const first = await mount({ returnedFromBlockId: block(1), initialBlockId: block(1) });
    try {
      await first.endDay();
      expect(summaryShown(first.host)).toBe(true);
    } finally { await first.dispose(); }
    navigation("reload");
    const reloaded = await mount({ returnedFromBlockId: block(1), initialBlockId: block(1) });
    try {
      expect(summaryShown(reloaded.host)).toBe(true);
      expect(reloaded.host.textContent).toContain("You opened 1 of 8 periods in this browser session.");
    } finally { await reloaded.dispose(); }
  });

  it("a fresh return after ending the day still reopens the day (unchanged), and counts are not duplicated", async () => {
    navigation("navigate");
    const first = await mount({ returnedFromBlockId: block(1), initialBlockId: block(2) });
    try { await first.endDay(); } finally { await first.dispose(); }
    const back = await mount({ returnedFromBlockId: block(1), initialBlockId: block(2) });
    try {
      expect(summaryShown(back.host)).toBe(false);
      await back.endDay();
      expect(back.host.textContent).toContain("You opened 1 of 8 periods in this browser session.");
    } finally { await back.dispose(); }
  });

  it("without Navigation Timing, behaviour is the previous (fresh-return) behaviour", async () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation((() => []) as never);
    const first = await mount({ returnedFromBlockId: block(1), initialBlockId: block(2) });
    try { await first.endDay(); } finally { await first.dispose(); }
    const again = await mount({ returnedFromBlockId: block(1), initialBlockId: block(2) });
    try { expect(summaryShown(again.host)).toBe(false); } finally { await again.dispose(); }
  });
});

describe("Fix 2: honest clock copy for pilot days", () => {
  const nowText = (host: HTMLElement) => host.querySelector('[data-label="Now"]')!.textContent ?? "";
  it("RED: 02:07 on a pilot day says the periods are open for practice", async () => {
    const page = await mount({ clockAt: "02:07" });
    try { expect(nowText(page.host)).toContain("Outside school hours. Your periods are open for practice."); } finally { await page.dispose(); }
  });
  it("RED: 21:30 (after the last period) says the same, not 'School is over'", async () => {
    const page = await mount({ clockAt: "21:30" });
    try { expect(nowText(page.host)).toContain("Outside school hours. Your periods are open for practice."); } finally { await page.dispose(); }
  });
  it("RED: between two periods it says so, not 'School is over for today'", async () => {
    const page = await mount({ clockAt: "08:37" });
    try { expect(nowText(page.host)).toContain("Between periods."); } finally { await page.dispose(); }
  });
  it("08:10 shows the current period", async () => {
    const page = await mount({ clockAt: "08:10" });
    try { expect(nowText(page.host)).toContain("08:00"); expect(nowText(page.host)).not.toContain("Outside school hours"); } finally { await page.dispose(); }
  });
  it("a non-pilot day is unchanged", async () => {
    const plan = { ...day, source: "RESOLVED_PLAN" as never };
    const page = await mount({ day: plan, clockAt: "02:07" });
    try { expect(nowText(page.host)).toContain("School has not started yet."); } finally { await page.dispose(); }
  });
  it.each([["08:10", "08:10"], ["23:59", "23:59"], ["8:10", null], ["24:00", null], ["08:60", null], ["08:10 ", null], [["08:10", "09:00"], null], [undefined, null]])(
    "RED: ?clock=%j is %j", (raw, expected) => {
      expect(parseRehearsalClock(raw as never)).toBe(expected);
    });
});

/**
 * Atlas R1 (REVISE on 233f9fb4): two distinct same-date plans can keep identical timetable ids, so block ids
 * (`pilot:<date>:<timetableId>`) collide and a key built from the date-only planId let Plan A's opened periods count
 * in Plan B. The key must carry the plan's own identity (a digest of its periods and bindings).
 */
describe("R1: the session key distinguishes same-date plans with identical timetable ids", () => {
  // Plan B: same date, same timetable ids, classes, labels and times, but periods 1-2 bind different lesson packages.
  const pilotB: PilotDay = { ...pilot, periods: pilot.periods.map((p, i) => (i < 2 && p.status === "ADMITTED"
    ? { ...p, selection: `factory@synthetic@lesson-b-${i + 1}`, packageHash: "b".repeat(64), href: `/learn/preview/lesson-b-${i + 1}` } : p)) };
  const planB = schoolDayFromPilot(pilotB, null);
  const keyA = daySessionKey(day, lessons, "student-a");
  const keyB = daySessionKey(planB.day, planB.lessons, "student-a");
  it("RED: the two plans really share the date-only plan id and every block id", () => {
    expect(planB.day.planId).toBe(day.planId);
    expect(planB.day.blocks.map((b) => b.id)).toEqual(day.blocks.map((b) => b.id));
  });
  it("RED: their session keys differ; the same plan rebuilt gives the same key", () => {
    expect(keyB).not.toBe(keyA);
    const rebuilt = schoolDayFromPilot(JSON.parse(JSON.stringify(pilot)) as PilotDay, null);
    expect(daySessionKey(rebuilt.day, rebuilt.lessons, "student-a")).toBe(keyA);
  });
  it("RED: signed-in-user isolation is kept and the raw user id never appears", () => {
    expect(daySessionKey(day, lessons, "student-b")).not.toBe(keyA);
    expect(keyA).not.toContain("student-a");
  });
  it("RED: periods opened in Plan A do not count in Plan B", async () => {
    for (const n of [1, 2]) await (await mount({ sessionKey: keyA, returnedFromBlockId: block(n), initialBlockId: block(n + 1) })).dispose();
    const b = await mount({ day: planB.day, lessons: planB.lessons, sessionKey: keyB });
    try {
      await b.endDay();
      expect(b.host.textContent).toContain("You opened 0 of 8 periods in this browser session.");
    } finally { await b.dispose(); }
    const a = await mount({ sessionKey: keyA });
    try {
      await a.endDay();
      expect(a.host.textContent).toContain("You opened 2 of 8 periods in this browser session.");
    } finally { await a.dispose(); }
  });
});
