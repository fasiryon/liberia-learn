// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/student/learn";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/LanguageSelector", () => ({ LanguageSelector: () => null }));
vi.mock("@/lib/lesson-offline-cache", () => ({ isLessonCached: vi.fn(async () => false) }));

import { StudentShellV2 } from "@/components/student/StudentShellV2";
import { LearnV2 } from "@/components/student/learn/LearnV2";
import { LessonCatalog } from "@/components/student/learn/LessonCatalog";
import UnitOverviewClient from "@/app/student/units/[unitId]/UnitOverviewClient";
import { catalogConfirmed, groupBySubject, learnResources, learnTarget, openAssignments, validGovernedAction } from "@/components/student/learn/learnPresentation";

const governed = { available: true, decisionId: "decision-1", sessionId: "session-1", releaseId: "release-1", releaseIdentity: "identity-1", learnerStateRevision: "7",
  grade: 4, subject: "MATH", conceptLabel: "Equivalent fractions", action: { kind: "PRACTICE", reason: "Server-supplied reason" },
  item: { id: "item-1", version: "3", prompt: "Which fraction equals 1/2?", options: ["2/4", "1/3"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: null };
const unit = { unitId: "u-1", unitName: "Fractions on a number line", subject: "MATH", grade: 4, completedCount: 2, totalCount: 5, completionPct: 40 };
const catalog = { studentId: "s-1", grade: 4, page: 1, totalPages: 1, items: [{ contentId: "c-1", displayTitle: "Comparing fractions", subject: "MATH", grade: 4 }], subjectCompletion: [{ subject: "MATH", total: 10, completed: 3 }] };
const work = { assignments: [{ id: "a-1", title: "Reading for meaning", subject: "ENGLISH", dueAt: "2026-10-08T09:00:00Z", isOverdue: true, submission: null },
  { id: "a-2", title: "Submitted already", subject: "MATH", dueAt: null, isOverdue: false, submission: { turnedInAt: "2026-10-01T00:00:00Z" } }] };

type Reply = { status?: number; body?: unknown; reject?: boolean };
let replies: Record<string, Reply>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const key = Object.keys(replies).sort((a, b) => b.length - a.length).find((prefix) => url.startsWith(prefix));
  const reply = key ? replies[key] : { status: 404, body: {} };
  if (reply.reject) throw new TypeError("Failed to fetch");
  const status = reply.status ?? 200;
  return { ok: status < 400, status, json: async () => (typeof reply.body === "function" ? (reply.body as any)(init) : reply.body) } as Response;
});
const base = (): Record<string, Reply> => ({
  "/api/student/learning-authority/next-action": { body: governed },
  "/api/student/units/active": { body: [unit] },
  "/api/student/lessons": { body: catalog },
  "/api/student/assignments": { body: work },
});

let root: Root; let host: HTMLDivElement;
beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { pathname = "/student/learn"; replies = base(); fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock); localStorage.clear(); });
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); vi.unstubAllGlobals(); });

async function render(node: React.ReactNode, grade: number | null = 4, userId = "learner-1") {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root.render(<StudentShellV2 identity={{ name: "Pewu Learner", grade, userId, schoolId: "school-1" }}>{node}</StudentShellV2>); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
const text = () => host.textContent ?? "";
const headings = () => [...host.querySelectorAll("main h1, main h2")].map((h) => `${h.tagName}:${h.textContent}`);

describe("Learn V2 presentation contract", () => {
  it("accepts only complete governed actions and same-origin learn targets", () => {
    expect(validGovernedAction(governed)).toBe(true);
    expect(validGovernedAction({ ...governed, decisionId: "" })).toBe(false);
    expect(validGovernedAction({ ...governed, item: { ...governed.item, options: [] } })).toBe(false);
    for (const bad of ["https://evil.test/x", "//evil.test", "/admin", "/student/lesson/a/b", "/student/lesson/a\\b"]) expect(learnTarget(bad)).toBe(false);
    expect(learnTarget("/student/lessons/sw-1")).toBe(true);
  });
  it("treats an identity-less lessons response as unconfirmed, never empty", () => {
    expect(catalogConfirmed({ items: [], page: 1, totalPages: 0 })).toBe(false);
    expect(catalogConfirmed({ items: [], page: 1, totalPages: 0, studentId: "s" })).toBe(true);
  });
  it("keeps server order: no ranking in grouping or open-work filtering", () => {
    expect(groupBySubject([{ subject: "B", n: 1 }, { subject: "A", n: 2 }, { subject: "B", n: 3 }]).map((g) => [g.subject, g.items.map((i) => i.n)])).toEqual([["B", [1, 3]], ["A", [2]]]);
    expect(openAssignments(work.assignments as any).map((a) => a.id)).toEqual(["a-1"]);
  });
  it("lists WAEC only under the shell's existing grade rule and hides grade resources without a grade", () => {
    expect(learnResources(4, 10).some((r) => r.id === "waec")).toBe(false);
    expect(learnResources(11, 10).some((r) => r.id === "waec")).toBe(true);
  });
});

describe("Learn V2 composition", () => {
  it("keeps the governed task first-class, inline and answerable before discovery", async () => {
    await render(<LearnV2 />);
    expect(headings()).toEqual(["H1:Your learning", "H2:Equivalent fractions", "H2:Your learning path", "H2:Assigned work", "H2:Books and resources"]);
    const current = host.querySelector("[aria-labelledby=current-learning-heading]")!;
    expect(current.compareDocumentPosition(host.querySelector("#path-heading")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(current.querySelectorAll("input[type=radio]").length).toBe(2);
    expect(current.querySelectorAll(".pdv2-action-primary").length).toBe(1);
    expect(current.querySelector("a[href='/student/learn']")).toBeNull();
    expect(text()).toContain("Server-supplied reason");
  });
  it("submits the exact issued decision/session/item identity", async () => {
    replies["/api/student/learning-authority/next-action"] = { body: (init?: RequestInit) => init?.method === "POST"
      ? { correct: true, learnerState: { mastery: { level: "DEVELOPING", observedScore: 1 }, confidence: { level: "LOW" } } } : governed };
    await render(<LearnV2 />);
    const radio = host.querySelector<HTMLInputElement>("input[type=radio]")!;
    await act(async () => { radio.click(); });
    const submit = [...host.querySelectorAll("button")].find((b) => b.textContent === "Submit answer")!;
    await act(async () => { submit.click(); });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ decisionId: "decision-1", sessionId: "session-1", itemId: "item-1", itemVersion: "3", answerIndex: 0, toolsUsed: [] });
    expect(text()).toContain("It is not a school grade");
  });
  it("renders discovery sections separately with authorized rows and links", async () => {
    await render(<LearnV2 />);
    expect(host.querySelector("a[aria-label='Open unit: Fractions on a number line']")?.getAttribute("href")).toBe("/student/units/u-1");
    expect(host.querySelector("a[aria-label='Open lesson: Comparing fractions']")?.getAttribute("href")).toBe("/student/lesson/c-1");
    expect(host.querySelector("a[aria-label='Open assignment: Reading for meaning']")?.getAttribute("href")).toBe("/student/assignments/a-1");
    expect(text()).not.toContain("Submitted already");
    expect(text()).toContain("2 of 5 lessons completed");
    expect(text()).toContain("3 of 10 scheduled lessons completed");
    for (const href of ["/student/textbooks", "/student/adaptive", "/student/offline-lessons", "/student/exams", "/student/assignments", "/student/lessons"]) expect(host.querySelector(`main a[href='${href}']`)).not.toBeNull();
  });
  it.each([[{ available: false }, "No activity is ready right now"], [{ available: false, status: "NO_VALID_RESOURCE" }, "Ask your teacher for your next step"]])("shows the no-plan state truthfully (%o)", async (body, copy) => {
    replies["/api/student/learning-authority/next-action"] = { body };
    await render(<LearnV2 />);
    expect(text()).toContain(copy);
    expect(host.querySelector("input[type=radio]")).toBeNull();
    expect(text()).toContain("Your learning path");
  });
  it("shows confirmed empty sections with empty copy", async () => {
    replies["/api/student/units/active"] = { body: [] };
    replies["/api/student/lessons"] = { body: { ...catalog, items: [], subjectCompletion: [] } };
    replies["/api/student/assignments"] = { body: { assignments: [] } };
    await render(<LearnV2 />);
    expect(text()).toContain("No units are scheduled for your class this week.");
    expect(text()).toContain("No lessons are published for your grade yet.");
    expect(text()).toContain("No open assignments right now.");
  });
  it("never turns failures or unconfirmed catalogs into empty states", async () => {
    replies["/api/student/units/active"] = { status: 503, body: {} };
    replies["/api/student/lessons"] = { body: { grade: null, count: 0, total: 0, page: 1, totalPages: 0, items: [] } };
    replies["/api/student/assignments"] = { reject: true };
    await render(<LearnV2 />);
    expect(text()).toContain("Your units could not load. This does not mean you have none.");
    expect(text()).toContain("Your lesson list could not be confirmed right now.");
    expect(text()).toContain("Your assignments could not load.");
    expect(text()).not.toMatch(/No units are scheduled|No lessons are published|No open assignments/);
  });
  it("labels restricted sections without exposing rows", async () => {
    replies["/api/student/assignments"] = { status: 403, body: {} };
    await render(<LearnV2 />);
    expect(text()).toContain("Restricted");
    expect(host.querySelector("a[aria-label^='Open assignment']")).toBeNull();
  });
  it("marks rows stale when a refresh fails after a good load", async () => {
    await render(<LearnV2 />);
    replies["/api/student/assignments"] = { reject: true };
    const refresh = [...host.querySelectorAll("button")].find((b) => b.textContent === "Refresh")!;
    await act(async () => { refresh.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(text()).toContain("Your assignments could not refresh. These may have changed.");
    expect(host.querySelector("a[aria-label='Open assignment: Reading for meaning']")).not.toBeNull();
    expect(text()).toContain("Last loaded");
  });
  it("offline shows only this learner's saved activity, read-only, and drops the shared legacy cache", async () => {
    localStorage.setItem("governed-learning-action-v2", JSON.stringify({ ...governed, conceptLabel: "Another learner" }));
    localStorage.setItem("governed-learning-action-v2:school-1:learner-1", JSON.stringify(governed));
    replies["/api/student/learning-authority/next-action"] = { reject: true };
    await render(<LearnV2 />);
    expect(text()).toContain("Last saved · read-only");
    expect(text()).not.toContain("Another learner");
    expect(localStorage.getItem("governed-learning-action-v2")).toBeNull();
    expect(host.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
    expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Submit answer")!.hasAttribute("disabled")).toBe(true);
  });
  it("does not show a cached activity to a different learner on the device", async () => {
    localStorage.setItem("governed-learning-action-v2:school-1:learner-1", JSON.stringify(governed));
    replies["/api/student/learning-authority/next-action"] = { reject: true };
    await render(<LearnV2 />, 4, "learner-2");
    expect(host.querySelector("input[type=radio]")).toBeNull();
    expect(text()).toContain("could not load");
  });
  it("does not substitute a cached activity for an authorization failure", async () => {
    localStorage.setItem("governed-learning-action-v2:school-1:learner-1", JSON.stringify(governed));
    replies["/api/student/learning-authority/next-action"] = { status: 403, body: {} };
    await render(<LearnV2 />);
    expect(host.querySelector("input[type=radio]")).toBeNull();
    expect(text()).toContain("isn't available for your account");
  });
  it.each([[2, "young", "Check answer", 3], [6, "middle", "Submit answer", 5]])("grade %i renders the %s band", async (grade, band, label, limit) => {
    replies["/api/student/assignments"] = { body: { assignments: Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, title: `Work ${i}`, subject: "MATH", dueAt: null, isOverdue: false, submission: null })) } };
    await render(<LearnV2 />, grade);
    expect(host.querySelector("[data-age-band]")?.getAttribute("data-age-band")).toBe(band);
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === label)).toBe(true);
    expect(host.querySelectorAll("a[aria-label^='Open assignment']").length).toBe(limit);
  });
  it("explains missing grade resources instead of listing them", async () => {
    await render(<LearnV2 />, null);
    expect(text()).toContain("Your grade is not set yet");
    expect(host.querySelector("main a[href='/student/textbooks']")).toBeNull();
    expect(host.querySelector("main a[href='/student/offline-lessons']")).not.toBeNull();
  });
});

describe("Student shell on Learn", () => {
  it("marks Learn active without duplicating primary nav or resource links", async () => {
    await render(<LearnV2 />);
    const nav = host.querySelector("nav[aria-label=Student]")!;
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent?.replace("→", "").trim())).toEqual(["Today", "Learn", "Labs", "Progress", "Help"]);
    expect(nav.querySelector("a[aria-current=page]")?.textContent).toContain("Learn");
    expect(host.querySelector("nav[aria-label='learn resources']")).toBeNull();
  });
  it("exposes a visible Sign out through the safe-logout page and keeps account preferences", async () => {
    await render(<LearnV2 />);
    const railSignOut = host.querySelector(".pdv2-rail-support a.pdv2-action-quiet")!;
    expect(railSignOut.textContent).toBe("Sign out");
    expect(railSignOut.getAttribute("href")).toBe("/signout");
    expect(host.querySelector(".pdv2-account-menu summary")?.textContent).toBe("Account");
    expect(host.querySelector(".pdv2-account-menu a[href='/signout']")?.textContent).toBe("Sign out");
    expect(host.querySelector("a[href='/api/auth/signout']")).toBeNull();
    const prefs = [...host.querySelectorAll("details.pdv2-secondary")].find((d) => d.querySelector("summary")?.textContent === "Account and preferences")!;
    for (const href of ["/student/change-pin", "/student/placement", "/student/onboarding", "/signout"]) expect(prefs.querySelector(`a[href='${href}']`)).not.toBeNull();
  });
});

describe("Lessons and unit discovery", () => {
  it("groups the catalog by subject and pages without inventing a total", async () => {
    pathname = "/student/lessons";
    replies["/api/student/lessons?page=1"] = { body: { ...catalog, totalPages: 2 } };
    replies["/api/student/lessons?page=2"] = { body: { ...catalog, page: 2, totalPages: 2, items: [{ contentId: "c-2", displayTitle: "Reading stories", subject: "ENGLISH", grade: 4 }] } };
    await render(<LessonCatalog />);
    expect(headings()).toEqual(["H1:Lessons for your grade", "H2:Math"]);
    const more = [...host.querySelectorAll("button")].find((b) => b.textContent === "Show more lessons")!;
    await act(async () => { more.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(headings()).toEqual(["H1:Lessons for your grade", "H2:Math", "H2:English"]);
    expect(host.querySelector("a[aria-label='Open lesson: Reading stories']")?.getAttribute("href")).toBe("/student/lesson/c-2");
  });
  it("shows a catalog failure with retry, not 'no lessons'", async () => {
    replies["/api/student/lessons"] = { status: 500, body: {} };
    await render(<LessonCatalog />);
    expect(text()).toContain("Unavailable");
    expect(text()).not.toContain("No lessons are published");
  });
  it("keeps server locks: locked lessons are labelled and not linked", async () => {
    pathname = "/student/units/u-1";
    replies["/api/student/units/u-1"] = { body: { unitId: "u-1", unitName: "A very long unit name that keeps going to test wrapping behaviour on narrow phones", subject: "MATH", grade: 4, completedCount: 1, totalCount: 3, completionPct: 33, lessons: [
      { contentId: "l1", title: "Done", orderInUnit: 1, lessonType: null, status: "completed", scheduledWorkId: null, locked: false, href: "/student/lesson/l1" },
      { contentId: "l2", title: "Now", orderInUnit: 2, lessonType: null, status: "current", scheduledWorkId: "sw2", locked: false, href: "/student/lessons/sw2" },
      { contentId: "l3", title: "Later", orderInUnit: 3, lessonType: null, status: "upcoming", scheduledWorkId: null, locked: true, href: "/student/lesson/l3" }] } };
    await render(<UnitOverviewClient unitId="u-1" />);
    expect(host.querySelector("a[href='/student/lesson/l3']")).toBeNull();
    expect(text()).toContain("Locked · finish earlier lessons first");
    expect(host.querySelector("li[aria-current=step] a")?.getAttribute("href")).toBe("/student/lessons/sw2");
    expect(host.querySelector("a[aria-label='Review lesson 1: Done']")).not.toBeNull();
    expect(text()).toContain("Completing lessons is not the same as mastering them");
  });
  it.each([[404, "This unit isn't available"], [403, "Restricted"], [500, "Try again"]])("unit %i is presented honestly", async (status, copy) => {
    replies["/api/student/units/u-9"] = { status, body: {} };
    await render(<UnitOverviewClient unitId="u-9" />);
    expect(text()).toContain(copy);
  });
});
