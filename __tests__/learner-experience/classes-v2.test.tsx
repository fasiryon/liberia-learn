// @vitest-environment jsdom
import { act } from "react";
import { existsSync } from "fs";
import path from "path";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let pathname = "/student/classes";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/LanguageSelector", () => ({ LanguageSelector: () => null }));

import { StudentShellV2 } from "@/components/student/StudentShellV2";
import { MyClassesView } from "@/components/student/classes/MyClasses";
import { ClassDetailView } from "@/components/student/classes/ClassDetail";
import { ScheduleView } from "@/components/student/classes/Schedule";
import { classTarget, validMyClasses } from "@/components/student/classes/classesPresentation";
import { activeDestination, STUDENT_PRIMARY_NAV } from "@/lib/learner-experience/studentNavigation";
import type { ClassDetailReadModel, ScheduleReadModel } from "@/lib/student/classes.server";

const summary = { classId: "class-a1", name: "Grade 4A Mathematics", subject: "MATH", grade: 4, teacherName: "Mr. Kollie", schoolName: "Monrovia Central", href: "/student/classes/class-a1",
  currentUnit: { unitId: "u-1", title: "Fractions", href: "/student/units/u-1" },
  nextClass: { date: "2026-10-09", dayName: "Friday", periodLabel: "Period 2", timeRange: "9:00 AM – 9:45 AM", isToday: true, state: "upcoming" as const },
  nextWork: { date: "2026-10-12", title: "Tenths and hundredths", href: "/student/lesson/c-2" }, timetableConfigured: true, openAssignmentCount: 2 };
const classes = { schemaVersion: "student-classes/1" as const, availability: "current" as const, enrolled: true, today: "2026-10-09", classes: [summary] };
const detail: ClassDetailReadModel = {
  schemaVersion: "student-class/1", availability: "current", generatedAt: "2026-10-09T08:30:00Z", timeZone: "Africa/Monrovia", today: "2026-10-09",
  class: { classId: "class-a1", name: "Grade 4A Mathematics", subject: "MATH", grade: 4, teacherName: "Mr. Kollie", schoolName: "Monrovia Central" },
  currentUnit: summary.currentUnit, nextClass: { ...summary.nextClass, id: "t-2", classId: "class-a1", dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "09:45", room: null, teacherName: "Mr. Kollie" }, nextWork: { ...summary.nextWork, scheduledWorkId: "sw-2" },
  schedule: { configured: true, slots: [{ id: "t-2", classId: "class-a1", dayOfWeek: "FRIDAY", dayName: "Friday", periodLabel: "Period 2", startTime: "09:00", endTime: "09:45", timeRange: "9:00 AM – 9:45 AM", room: "4A", teacherName: "Mr. Kollie" }] },
  assignedWork: [
    { id: "as-1", title: "Fraction practice", dueAt: null, status: "open", state: "open", locked: false, href: "/student/assignments/as-1" },
    { id: "as-2", title: "Locked work", dueAt: null, status: "overdue", state: "unavailable", locked: true, href: null, reason: "This activity is not available" },
    { id: "as-3", title: "Done work", dueAt: null, status: "submitted", state: "open", locked: false, href: "/student/assignments/as-3" }],
  lessons: [{ contentId: "c-1", title: "Comparing fractions", contentType: "lesson", unitId: "u-1", href: "/student/lesson/c-1", state: "open", locked: false, scheduledDate: "2026-10-05", status: "completed" }],
  resources: [], progress: { scheduledToDate: 3, completed: 1 },
};
const period = (id: string, state: "completed" | "current" | "upcoming", links: Array<{ kind: "lesson" | "assignment"; title: string; href: string }> = []) => ({
  id, classId: "class-a1", dayOfWeek: "FRIDAY" as const, dayName: "Friday", periodLabel: id, startTime: "08:00", endTime: "08:45", timeRange: "8:00 AM – 8:45 AM", room: null,
  teacherName: "Mr. Kollie", className: "Grade 4A Mathematics", subject: "MATH", state, plannedTitle: null, links });
const schedule = (overrides: Partial<Extract<ScheduleReadModel, { availability: "current" }>> = {}): ScheduleReadModel => ({
  schemaVersion: "student-schedule/1", availability: "current", generatedAt: "2026-10-09T08:30:00Z", timeZone: "Africa/Monrovia", today: "2026-10-09", enrolled: true, timetableConfigured: true,
  days: [
    { date: "2026-10-05", dayName: "Monday", isToday: false, periods: [period("Period 1", "completed")], otherWork: [] },
    { date: "2026-10-09", dayName: "Friday", isToday: true, periods: [period("Period 1", "current", [{ kind: "lesson", title: "Tenths", href: "/student/lesson/c-2" }, { kind: "assignment", title: "Bad", href: "https://evil.test" }]), period("Period 2", "upcoming")], otherWork: [] }],
  ...overrides,
} as ScheduleReadModel);

let root: Root; let host: HTMLDivElement;
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); });
async function render(node: React.ReactNode) {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root.render(<StudentShellV2 identity={{ name: "Pewu Learner", grade: 4, userId: "learner-1", schoolId: "school-1" }}>{node}</StudentShellV2>); });
}
const text = () => host.textContent ?? "";
const headings = () => [...host.querySelectorAll("main h1, main h2")].map((h) => h.textContent);

describe("Student shell and navigation", () => {
  it("keeps exactly the five primary destinations", () => expect(STUDENT_PRIMARY_NAV.map((n) => n.label)).toEqual(["Today", "Learn", "Labs", "Progress", "Help"]));
  it.each([["/student/classes", "LEARN"], ["/student/classes/class-a1", "LEARN"], ["/student/schedule", "TODAY"], ["/student/lessons", "LEARN"], ["/student/class/c/discussion", "LEARN"]])("places %s under %s", (route, target) => expect(activeDestination(route)).toBe(target));
  it("renders the five-item primary nav on My classes with Learn active and class utilities in Learn resources", async () => {
    pathname = "/student/classes";
    await render(<MyClassesView model={classes} today="2026-10-09" />);
    const nav = host.querySelector("nav[aria-label=Student]")!;
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent?.replace("→", ""))).toEqual(["Today", "Learn", "Labs", "Progress", "Help"]);
    expect(nav.querySelector("a[aria-current=page]")?.getAttribute("href")).toBe("/student/learn");
    const resources = host.querySelector("nav[aria-label='learn resources']")!;
    expect(resources.querySelector("a[href='/student/classes']")?.textContent).toBe("My classes →");
    expect(resources.querySelector("a[href='/student/schedule']")?.textContent).toBe("Class schedule →");
    expect(resources.querySelector("a[href='/student/lessons']")?.textContent).toBe("Lesson library →");
  });
  it("keeps the lesson catalog and lesson deep links routable", () => {
    for (const route of ["app/student/lessons/page.tsx", "app/student/lessons/[id]/page.tsx", "app/student/lesson/[contentId]/page.tsx"]) expect(existsSync(path.resolve(route))).toBe(true);
  });
});

describe("My classes page", () => {
  it("shows enrolled class cards with only server-returned facts and a class link", async () => {
    await render(<MyClassesView model={classes} today="2026-10-09" />);
    expect(headings()).toEqual(["My classes"]);
    expect(host.querySelector("a[aria-label='Open class: Grade 4A Mathematics']")?.getAttribute("href")).toBe("/student/classes/class-a1");
    for (const copy of ["Math · Grade 4", "Teacher: Mr. Kollie · Monrovia Central", "Fractions", "Today · Period 2 · 9:00 AM – 9:45 AM", "Tenths and hundredths", "Open assignments2"]) expect(text()).toContain(copy);
  });
  it("states missing values instead of inventing them", async () => {
    await render(<MyClassesView model={{ ...classes, classes: [{ ...summary, teacherName: null, currentUnit: null, nextClass: null, nextWork: null, timetableConfigured: false, openAssignmentCount: 0 }] }} today="2026-10-09" />);
    for (const copy of ["Teacher not listed", "None scheduled", "Timetable not set up", "Nothing scheduled"]) expect(text()).toContain(copy);
  });
  it.each([["unavailable", "This does not mean you have none"], ["restricted", "Restricted"]] as const)("shows %s honestly", async (model, copy) => {
    await render(<MyClassesView model={model} today="2026-10-09" />);
    expect(text()).toContain(copy);
    expect(host.querySelector(".pdv2-class-card")).toBeNull();
  });
  it("shows the not-enrolled state for an empty list", async () => {
    await render(<MyClassesView model={{ ...classes, availability: "empty", enrolled: false, classes: [] }} today="2026-10-09" />);
    expect(text()).toContain("You are not enrolled in a class yet");
  });
  it("accepts only learner class routes and well-formed payloads", () => {
    for (const bad of ["https://evil.test", "/student/classes/a/b", "/student/classes/a?x", "/admin"]) expect(classTarget(bad)).toBe(false);
    expect(validMyClasses(classes)).toBe(true);
    expect(validMyClasses({ ...classes, classes: [{ ...summary, openAssignmentCount: -1 }] })).toBe(false);
  });
});

describe("Class detail page", () => {
  it("organizes teacher, schedule, unit, assigned work, class lessons, resources and progress", async () => {
    pathname = "/student/classes/class-a1";
    await render(<ClassDetailView model={detail} />);
    expect(headings()).toEqual(["Grade 4A Mathematics", "Assigned work", "Class lessons", "Schedule", "Books and resources", "Your progress"]);
    expect(text()).toContain("Teacher: Mr. Kollie");
    expect(host.querySelector("a[aria-label='Open assignment: Fraction practice']")?.getAttribute("href")).toBe("/student/assignments/as-1");
    expect(host.querySelector("a[aria-label='Open assignment: Locked work']")).toBeNull();
    expect(text()).toContain("This activity is not available");
    expect(host.querySelector("a[aria-label='Open lesson: Comparing fractions']")?.getAttribute("href")).toBe("/student/lesson/c-1");
    expect(text()).toContain("Turned in (1)");
    expect(text()).toContain("1 of 3");
    expect(text()).toContain("No class resources have been shared yet.");
    for (const href of ["/student/schedule", "/student/progress", "/student/units/u-1", "/student/textbooks"]) expect(host.querySelector(`main a[href='${href}']`)).not.toBeNull();
  });
  it("says when the class has no timetable", async () => {
    await render(<ClassDetailView model={{ ...detail, nextClass: null, schedule: { configured: false, slots: [] } }} />);
    expect(text()).toContain("Your school has not set up a timetable for this class yet.");
    expect(text()).toContain("Timetable not set up");
  });
});

describe("Class schedule page", () => {
  it("shows today's periods with state, class link and only learner-route links", async () => {
    pathname = "/student/schedule";
    await render(<ScheduleView model={schedule()} view="today" />);
    expect(host.querySelector("nav[aria-label=Student] a[aria-current=page]")?.getAttribute("href")).toBe("/student/today");
    const rows = [...host.querySelectorAll(".pdv2-period-list > li")];
    expect(rows.map((row) => row.getAttribute("data-state"))).toEqual(["current", "upcoming"]);
    expect(rows[0].textContent).toContain("Now");
    expect(rows[0].querySelector("a[href='/student/classes/class-a1']")).not.toBeNull();
    expect(host.querySelector("a[href='/student/lesson/c-2']")?.textContent).toBe("Lesson: Tenths →");
    expect(host.querySelector("a[href='https://evil.test']")).toBeNull();
    expect(host.querySelector("a[href='/student/schedule?view=week']")).not.toBeNull();
  });
  it("week view renders only the days the server returned", async () => {
    await render(<ScheduleView model={schedule()} view="week" />);
    expect([...host.querySelectorAll(".pdv2-schedule-day h2")].map((h) => h.textContent)).toEqual(["Monday 5 Oct", "Today Fri, 9 Oct"]);
    expect(host.querySelector(".pdv2-period-list > li[data-state=completed]")?.textContent).toContain("Ended");
  });
  it("is honest with no timetable, not enrolled, and failures", async () => {
    await render(<ScheduleView model={schedule({ timetableConfigured: false, days: [{ date: "2026-10-09", dayName: "Friday", isToday: true, periods: [], otherWork: [] }] })} view="today" />);
    expect(text()).toContain("Your school has not set up a class timetable yet.");
    expect(text()).toContain("No classes are on the timetable today.");
    act(() => root.unmount()); host.remove();
    await render(<ScheduleView model={schedule({ enrolled: false, timetableConfigured: false, days: [] })} view="today" />);
    expect(text()).toContain("You are not enrolled in a class yet");
    expect(text()).not.toContain("has not set up");
    act(() => root.unmount()); host.remove();
    await render(<ScheduleView model="unavailable" view="today" />);
    expect(text()).toContain("This does not mean you have no classes");
  });
});
