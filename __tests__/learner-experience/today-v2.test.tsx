// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { nextActionDisplay, studentTarget, dueText, type TodayData } from "@/lib/learner-experience/todayPresentation";
import { activeDestination, STUDENT_PRIMARY_NAV } from "@/lib/learner-experience/studentNavigation";
vi.mock("next/navigation", () => ({ usePathname: () => "/student/today" }));
vi.mock("@/components/LanguageSelector", () => ({ LanguageSelector: () => null }));
vi.mock("@/lib/hooks/useVisibleInterval", () => ({ useVisibleInterval: (callback: () => void) => { const React = require("react"); React.useEffect(() => { callback(); }, []); } }));
vi.mock("@/lib/lesson-offline-cache", () => ({ isLessonCached: vi.fn(async () => false) }));
vi.mock("@/lib/offline-queue", () => ({ getQueue: async () => [{ status: "pending" }, { status: "sending" }], subscribeToQueueChanges: () => () => {} }));
vi.mock("@/components/LiveSessionBanner", () => ({ LiveSessionBanner: () => null }));
vi.mock("@/components/AnnouncementBanner", () => ({ AnnouncementBanner: () => null }));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
import { StudentShellV2 } from "@/components/student/StudentShellV2";
import { TodayV2 } from "@/components/student/TodayV2";

const today: TodayData = { availability: "current", items: [], completedCount: 2 };
const ready = <T,>(data: T) => ({ state: "ready" as const, data });
const governed = { available: true, decisionId: "sealed", conceptLabel: "Fractions", action: { kind: "PRACTICE" as const, reason: "Server-supplied reason" } };
let root: Root; let host: HTMLDivElement;
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); vi.unstubAllGlobals(); });
async function render(responses: Record<string, unknown>, grade = 4, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: status === 200, status, json: async () => responses[url] })));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root.render(<StudentShellV2 identity={{ name: "Learner", grade, userId: "u", schoolId: "s" }}><TodayV2 /></StudentShellV2>); });
}
const responses = () => ({ "/api/student/today": today, "/api/student/learning-authority/next-action": governed, "/api/student/assignments": { assignments: [{ id: "due", title: "Reading", subject: "ENGLISH", dueAt: "2026-10-08T09:00:00Z", isOverdue: true, submission: null }] }, "/api/student/teacher-lessons": { lessons: [] } });

describe("Today V2 authority and navigation", () => {
  it("has exactly the approved five destinations", () => expect(STUDENT_PRIMARY_NAV.map((n) => n.label)).toEqual(["Today", "Learn", "Labs", "Progress", "Help"]));
  it.each([["/student/events", "TODAY"], ["/student/class/c/discussion", "LEARN"], ["/student/discussion", "HELP"], ["/student/packs", "HELP"], ["/student/portfolio", "PROGRESS"], ["/student/lessons/old", "LEARN"], ["/student/labs/l", "LABS"], ["/assignments", "TODAY"]])("preserves membership for %s", (path, target) => expect(activeDestination(path)).toBe(target));
  it("leaves account/setup outside the five primary destinations", () => expect(activeDestination("/student/change-pin")).toBeNull());
  it("opens the existing governed activity directly, ignoring arbitrary lesson/priority alternatives", () => {
    const action = nextActionDisplay(ready(governed), ready({ ...today, todayFocus: { primaryLabel: "Wrong", primaryHref: "/student/lesson/other", currentOrNext: "Other" } }));
    expect(action).toMatchObject({ href: "/student/learn", reason: "Server-supplied reason", title: "Fractions" });
  });
  it("uses the existing server schedule target only when governed action is unavailable", () => expect(nextActionDisplay(ready({ available: false }), ready({ ...today, todayFocus: { primaryLabel: "Continue", primaryHref: "/student/lesson/scheduled", currentOrNext: "Scheduled" } }))).toMatchObject({ href: "/student/lesson/scheduled" }));
  it("does not turn failed authority into a school-generated recommendation", () => expect(nextActionDisplay({ state: "error", data: null }, ready(today)).state).toBe("error"));
  it.each(["stale", "unavailable"] as const)("does not turn %s plans into empty", (availability) => expect(nextActionDisplay(ready({ available: false }), ready({ ...today, availability })).state).toBe("error"));
  it("distinguishes no valid governed resource", () => expect(nextActionDisplay(ready({ available: false, status: "NO_VALID_RESOURCE" }), ready(today)).state).toBe("unavailable"));
  it("distinguishes genuine empty", () => expect(nextActionDisplay(ready({ available: false }), ready(today)).state).toBe("empty"));
  it("reserves loading", () => expect(nextActionDisplay({ state: "loading", data: null }, ready(today)).state).toBe("loading"));
  it.each(["https://evil.test", "//evil.test", "/admin", "/student/lesson\\evil"])("rejects unsafe target %s", (url) => expect(studentTarget(url)).toBe(false));
  it("uses server submission state rather than queued status", () => expect(dueText({ id: "a", title: "t", subject: "MATH", dueAt: null, isOverdue: false, submission: null })).not.toContain("Submitted"));
  it("renders one primary action, assigned work, native nav semantics and completion copy", async () => {
    await render(responses());
    expect(host.querySelectorAll(".pdv2-hero .pdv2-action-primary").length).toBe(1);
    expect(host.querySelector(".pdv2-hero a.pdv2-action-primary")?.getAttribute("href")).toBe("/student/learn");
    expect(host.querySelector("a[aria-label='Open assignment: Reading']")?.getAttribute("href")).toBe("/student/assignments/due");
    expect(host.textContent).toContain("Overdue"); expect(host.textContent).toContain("It does not measure mastery");
    expect(host.querySelector("a[aria-current=page]")?.textContent).toContain("Today");
    expect(host.textContent).toContain("waiting for server confirmation");
  });
  it.each([2, 6])("renders authorized grade %i variant", async (grade) => { await render(responses(), grade); expect(host.querySelector("[data-age-band]")?.getAttribute("data-age-band")).toBe(grade <= 3 ? "young" : "middle"); });
  it("exercises API failure without a cheerful empty state", async () => { await render(responses(), 4, 503); expect(host.textContent).toContain("unavailable"); expect(host.textContent).not.toContain("No open assignments were returned"); });
  it("survives malformed partial work while retaining governed action", async () => { await render({ ...responses(), "/api/student/today": { availability: "current", items: [null] } }); expect(host.textContent).toContain("School plan could not load"); expect(host.textContent).toContain("Fractions"); });
  it("rejects malformed timetable text without crashing on disclosure", async () => { await render({ ...responses(), "/api/student/today": { ...today, schoolDay: { note: null, items: [{ id: "p", subject: 42, status: "upcoming", primaryAction: { href: "/student/lessons", label: "Open" } }] } } }); expect(host.textContent).toContain("School plan could not load"); });
  it("rejects malformed teacher titles while preserving the learning action", async () => { await render({ ...responses(), "/api/student/teacher-lessons": { lessons: [{ id: "l", subject: "MATH", title: {}, lessonHref: "/student/lesson/l" }] } }); expect(host.textContent).toContain("Teacher lessons could not load"); expect(host.textContent).toContain("Fractions"); });
});
