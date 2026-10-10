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
import { ThisWeeksUnits } from "@/components/student/ThisWeeksUnits";
import UnitOverviewClient from "@/app/student/units/[unitId]/UnitOverviewClient";
import { groupBySubject, learnPlaces, learnTarget, validActiveUnits, validCatalog, validDiscovery, validGovernedAction } from "@/components/student/learn/learnPresentation";

const governed = { available: true, decisionId: "decision-1", sessionId: "session-1", releaseId: "release-1", releaseIdentity: "identity-1", learnerStateRevision: "7",
  grade: 4, subject: "MATH", conceptLabel: "Equivalent fractions", action: { kind: "PRACTICE", reason: "Server-supplied reason" },
  item: { id: "item-1", version: "3", prompt: "Which fraction equals 1/2?", options: ["2/4", "1/3"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: null };
const open = (href: string) => ({ state: "open", locked: false, href });
const lessonRow = (contentId: string, title: string, subject = "MATH") => ({ ...open(`/student/lesson/${contentId}`), contentId, title, subject, grade: 4, availability: "current" });
/** Shape of `learn-discovery/2` from lib/student/learnDiscovery.server.ts. */
function discovery(overrides: Record<string, any> = {}) {
  return {
    schemaVersion: "learn-discovery/2", availability: "current", freshness: "current", generatedAt: "2026-10-09T12:00:00Z",
    currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" },
    subjects: [{ subject: "MATH", label: "MATH" }, { subject: "ENGLISH", label: "ENGLISH" }],
    subjectCompletion: [{ subject: "MATH", total: 10, completed: 3, completionRate: 30 }, { subject: "ENGLISH", total: 0, completed: 0, completionRate: 0 }],
    lessons: { availability: "current", total: 37, items: [lessonRow("c-1", "Comparing fractions")] },
    activeUnits: { availability: "current", eligibility: "eligible", items: [{ ...open("/student/units/u-1"), unitId: "u-1", title: "Fractions on a number line", subject: "MATH", grade: 4, lessons: [] }] },
    assignedWork: { availability: "current", items: [
      { ...open("/student/assignments"), assignmentHref: "/student/assignments", id: "a-1", title: "Reading for meaning", subject: "ENGLISH", dueAt: "2026-10-08T09:00:00Z", content: null },
      { state: "unavailable", locked: true, href: null, lessonHref: null, reason: "This activity is not available", assignmentHref: "/student/assignments", id: "a-2", title: "Denied linked lesson", subject: "MATH", dueAt: null, content: null }] },
    checks: { availability: "current", total: 2, items: [
      { ...open("/student/exams/e-1"), id: "e-1", title: "Fractions check", subject: "MATH", status: "PUBLISHED" },
      { state: "unavailable", locked: true, href: null, reason: "This check is already completed", id: "e-2", title: "Place value check", subject: "MATH", status: "PUBLISHED" }] },
    resources: { availability: "current", items: [{ ...lessonRow("r-1", "Grade 4 reader"), id: "r-1", kind: "reading" }], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" },
    search: { availability: "deferred" }, limits: { perSection: 100, linkedContent: 200, catalogBoundReached: false },
    ...overrides,
  };
}
const unavailable = { availability: "unavailable", items: [] };
/** Shape of GET /api/student/classes from lib/student/enrollmentReadModel.ts. */
const classRow = (classId: string, className: string, extra: Record<string, unknown> = {}) => ({ classId, className, subject: "MATH", grade: 4, teacher: "Mr. Kollie", school: "Monrovia Central", ...extra });
const myClasses = (classes: unknown[] = [classRow("class-4a", "Grade 4A Mathematics")]) => ({ classes });

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
  "/api/student/learn": { body: discovery() },
  "/api/student/classes": { body: myClasses() },
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
const section = (id: string) => host.querySelector(`[aria-labelledby=${id}]`)!;
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe("Learn V2 presentation contract", () => {
  it("accepts only complete governed actions and same-origin learner targets", () => {
    expect(validGovernedAction(governed)).toBe(true);
    expect(validGovernedAction({ ...governed, decisionId: "" })).toBe(false);
    for (const bad of ["https://evil.test/x", "//evil.test", "/admin", "/student/lesson/a/b", "/student/lesson/a\\b", "/student/exams/x?y"]) expect(learnTarget(bad)).toBe(false);
    for (const good of ["/student/lessons/sw-1", "/student/exams/e-1", "/student/assignments", "/student/textbooks"]) expect(learnTarget(good)).toBe(true);
  });
  it("validates learn-discovery/2 and rejects other schemas or rows without server state", () => {
    expect(validDiscovery(discovery())).toBe(true);
    expect(validDiscovery({ ...discovery(), schemaVersion: "learn-discovery/1" })).toBe(false);
    expect(validDiscovery(discovery({ search: { availability: "current" } }))).toBe(false);
    const noState: any = discovery(); delete noState.lessons.items[0].state;
    expect(validDiscovery(noState)).toBe(false);
  });
  it("requires server availability on the lessons page and the units envelope", () => {
    expect(validCatalog({ items: [], page: 1, totalPages: 0, total: 0 })).toBe(false);
    expect(validCatalog({ availability: "current", items: [], page: 1, totalPages: 0, total: 0 })).toBe(true);
    expect(validActiveUnits([])).toBe(false);
    expect(validActiveUnits({ availability: "empty", eligibility: "not_enrolled", items: [] })).toBe(true);
  });
  it("keeps server order; navigation places make no availability claim", () => {
    expect(groupBySubject([{ subject: "B", n: 1 }, { subject: "A", n: 2 }, { subject: "B", n: 3 }]).map((g) => [g.subject, g.items.map((i) => i.n)])).toEqual([["B", [1, 3]], ["A", [2]]]);
    expect(learnPlaces(4, 10).map((p) => p.id)).toEqual(["practice", "projects", "offline"]);
    expect(learnPlaces(11, 10).some((p) => p.id === "waec")).toBe(true);
  });
});

describe("Learn V2 composition", () => {
  it("keeps the governed task first-class, inline and answerable; discovery is one separate read", async () => {
    await render(<LearnV2 />);
    // The browser harness asserts this order too: the governed task is first, then the learning path.
    expect(headings()).toEqual(["H1:Your learning", "H2:Equivalent fractions", "H2:Your learning path", "H2:Assigned work", "H2:Checks", "H2:Books and resources"]);
    const current = section("current-learning-heading");
    expect(current.compareDocumentPosition(host.querySelector("#my-classes-heading")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(current.querySelectorAll("input[type=radio]").length).toBe(2);
    expect(current.querySelectorAll(".pdv2-action-primary").length).toBe(1);
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual(["/api/student/classes", "/api/student/learn", "/api/student/learning-authority/next-action"]);
  });
  it("submits the exact issued decision/session/item identity", async () => {
    replies["/api/student/learning-authority/next-action"] = { body: (init?: RequestInit) => init?.method === "POST"
      ? { correct: true, learnerState: { mastery: { level: "DEVELOPING", observedScore: 1 }, confidence: { level: "LOW" } } } : governed };
    await render(<LearnV2 />);
    await act(async () => { host.querySelector<HTMLInputElement>("input[type=radio]")!.click(); });
    await act(async () => { button("Submit answer").click(); });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ decisionId: "decision-1", sessionId: "session-1", itemId: "item-1", itemVersion: "3", answerIndex: 0, toolsUsed: [] });
    expect(text()).toContain("It is not a school grade");
  });
  it("renders server-authorized units, classes, work, checks and readings with server hrefs; lessons are a browse destination", async () => {
    await render(<LearnV2 />);
    expect(host.querySelector("a[aria-label='Open unit: Fractions on a number line']")?.getAttribute("href")).toBe("/student/units/u-1");
    expect(host.querySelector("a[aria-label='Open class: Grade 4A Mathematics']")?.getAttribute("href")).toBe("/student/classes/class-4a");
    expect(host.querySelector("a[aria-label='Open lesson: Comparing fractions']")).toBeNull();
    expect(section("path-heading").querySelector("a[href='/student/lessons']")).not.toBeNull();
    expect(host.querySelector("a[aria-label='Open assignment: Reading for meaning']")?.getAttribute("href")).toBe("/student/assignments");
    expect(host.querySelector("a[aria-label='Open check: Fractions check']")?.getAttribute("href")).toBe("/student/exams/e-1");
    expect(host.querySelector("a[aria-label='Open reading: Grade 4 reader']")?.getAttribute("href")).toBe("/student/lesson/r-1");
    expect(text()).toContain("3 of 10 scheduled lessons completed");
    expect(text()).toContain("37 lessons available to you.");
    expect(host.querySelector("main a[href='/student/textbooks']")?.textContent).toBe("Textbooks →");
  });
  it("shows server locks and reasons without a link", async () => {
    await render(<LearnV2 />);
    expect(text()).toContain("This activity is not available");
    expect(text()).toContain("This check is already completed");
    expect(host.querySelector("a[aria-label='Open assignment: Denied linked lesson']")).toBeNull();
    expect(host.querySelector("a[aria-label='Open check: Place value check']")).toBeNull();
    expect(host.querySelectorAll(".pdv2-learn-locked").length).toBe(2);
  });
  it("never links a server row whose href is not a learner route", async () => {
    replies["/api/student/learn"] = { body: discovery({ lessons: { availability: "current", total: 1, items: [{ ...lessonRow("x", "Odd link"), href: "https://evil.test" }] } }) };
    await render(<LearnV2 />);
    expect(host.querySelector("a[href='https://evil.test']")).toBeNull();
    replies["/api/student/learn"] = { body: discovery({ activeUnits: { availability: "current", eligibility: "eligible", items: [{ ...open("https://evil.test"), unitId: "u-x", title: "Odd unit", subject: "MATH", grade: 4, lessons: [] }] } }) };
    await act(async () => { button("Refresh").click(); }); await settle();
    expect(host.querySelector("a[href='https://evil.test']")).toBeNull();
    expect(section("path-heading").textContent).toContain("Unavailable");
  });
  it.each([[{ available: false }, "No activity is ready right now"], [{ available: false, status: "NO_VALID_RESOURCE" }, "Ask your teacher for your next step"]])("shows the no-plan state truthfully (%o)", async (body, copy) => {
    replies["/api/student/learning-authority/next-action"] = { body };
    await render(<LearnV2 />);
    expect(text()).toContain(copy);
    expect(host.querySelector("input[type=radio]")).toBeNull();
    expect(text()).toContain("Fractions on a number line");
  });
  it("shows server-confirmed empty sections with empty copy", async () => {
    replies["/api/student/learn"] = { body: discovery({ availability: "empty", lessons: { availability: "empty", total: 0, items: [] },
      activeUnits: { availability: "empty", eligibility: "eligible", items: [] }, assignedWork: { availability: "empty", items: [] },
      checks: { availability: "empty", total: 0, items: [] }, resources: { availability: "empty", items: [], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" } }) };
    await render(<LearnV2 />);
    for (const copy of ["No units are scheduled for your class this week.", "No lessons are published for your grade and classes yet.", "No assignments right now.", "No checks are open for you right now.", "No readings are published"]) expect(text()).toContain(copy);
  });
  it("distinguishes not enrolled from an empty week", async () => {
    replies["/api/student/learn"] = { body: discovery({ subjects: [], subjectCompletion: [], activeUnits: { availability: "empty", eligibility: "not_enrolled", items: [] } }) };
    await render(<LearnV2 />);
    expect(text()).toContain("You are not enrolled in a class yet");
    expect(text()).not.toContain("No units are scheduled");
  });
  it("shows server-unavailable sections and the server's check reason, never empty copy", async () => {
    replies["/api/student/learn"] = { body: discovery({ lessons: { ...unavailable, total: 0 }, activeUnits: { ...unavailable, eligibility: "unavailable" }, checks: { ...unavailable, total: 0, reason: "Checks are not available" } }) };
    await render(<LearnV2 />);
    expect(text()).toContain("Your lessons could not load. This does not mean you have none.");
    expect(text()).toContain("Your units could not load.");
    expect(text()).toContain("Checks are not available");
    expect(text()).not.toMatch(/No units are scheduled|No lessons are published|No checks are open/);
  });
  it("treats a 503 discovery response as unavailable while the governed task still works", async () => {
    replies["/api/student/learn"] = { status: 503, body: discovery({ availability: "unavailable" }) };
    await render(<LearnV2 />);
    expect(text()).toContain("Your assignments could not load.");
    expect(text()).not.toMatch(/No assignments right now|No units are scheduled/);
    expect(host.querySelector("input[type=radio]")).not.toBeNull();
  });
  it.each([[401, "Signed out"], [403, "Restricted"]])("labels a %i discovery response without exposing rows", async (status, badge) => {
    replies["/api/student/learn"] = { status, body: { error: "denied" } };
    await render(<LearnV2 />);
    expect(text()).toContain(badge);
    expect(host.querySelector("a[aria-label^='Open lesson']")).toBeNull();
  });
  it("marks rows stale after a failed refresh, and drops them on a later denial", async () => {
    await render(<LearnV2 />);
    replies["/api/student/learn"] = { reject: true };
    await act(async () => { button("Refresh").click(); }); await settle();
    expect(text()).toContain("Your assignments could not be checked just now. These are from the last check and may have changed.");
    expect(host.querySelector("a[aria-label='Open assignment: Reading for meaning']")).not.toBeNull();
    replies["/api/student/learn"] = { status: 403, body: {} };
    await act(async () => { button("Refresh").click(); }); await settle();
    expect(host.querySelector("a[aria-label='Open assignment: Reading for meaning']")).toBeNull();
    expect(text()).toContain("Restricted");
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
    expect(button("Submit answer").hasAttribute("disabled")).toBe(true);
  });
  it("does not show a cached activity to a different learner on the device", async () => {
    localStorage.setItem("governed-learning-action-v2:school-1:learner-1", JSON.stringify(governed));
    replies["/api/student/learning-authority/next-action"] = { reject: true };
    await render(<LearnV2 />, 4, "learner-2");
    expect(host.querySelector("input[type=radio]")).toBeNull();
  });
  it("does not substitute a cached activity for an authorization failure", async () => {
    localStorage.setItem("governed-learning-action-v2:school-1:learner-1", JSON.stringify(governed));
    replies["/api/student/learning-authority/next-action"] = { status: 403, body: {} };
    await render(<LearnV2 />);
    expect(host.querySelector("input[type=radio]")).toBeNull();
    expect(text()).toContain("isn't available for your account");
  });
  it.each([[2, "young", "Check answer", 3], [6, "middle", "Submit answer", 5]])("grade %i renders the %s band", async (grade, band, label, limit) => {
    replies["/api/student/learn"] = { body: discovery({ assignedWork: { availability: "current", items: Array.from({ length: 7 }, (_, i) => ({ ...open("/student/assignments"), assignmentHref: "/student/assignments", id: `w${i}`, title: `Work ${i}`, subject: "MATH", dueAt: null })) } }) };
    await render(<LearnV2 />, grade);
    expect(host.querySelector("[data-age-band]")?.getAttribute("data-age-band")).toBe(band);
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === label)).toBe(true);
    expect(host.querySelectorAll("a[aria-label^='Open assignment']").length).toBe(limit);
  });
  it("adds no search control while search is deferred", async () => {
    await render(<LearnV2 />);
    expect(host.querySelector("input[type=search], [role=search]")).toBeNull();
  });
});

describe("Learn V2 stale snapshots (cross-builder gate P1)", () => {
  const emptySnapshot = () => discovery({ availability: "empty", lessons: { availability: "empty", total: 0, items: [] },
    activeUnits: { availability: "empty", eligibility: "eligible", items: [] }, assignedWork: { availability: "empty", items: [] },
    checks: { availability: "empty", total: 0, items: [] }, resources: { availability: "empty", items: [], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" } });
  const CONFIRMED_EMPTY = /No units are scheduled|No lessons are published|No assignments right now|No checks are open|No readings are published|You are not enrolled in a class yet/;
  const refresh = async () => { await act(async () => { button("Refresh").click(); }); await settle(); };
  const setOnline = (value: boolean) => act(() => { Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value }); window.dispatchEvent(new Event(value ? "online" : "offline")); });
  afterEach(() => { Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true }); });
  const expectEmptyIsHistory = () => {
    expect(text()).not.toMatch(CONFIRMED_EMPTY);
    for (const what of ["units", "lessons", "assignments", "checks", "readings"]) expect(text()).toContain(`When last checked, you had no ${what}. Your current ${what} could not be checked`);
    expect(text()).toContain("Last checked earlier");
  };

  it("1. current empty snapshot then 503 refresh: empty is history, not a current fact", async () => {
    replies["/api/student/learn"] = { body: emptySnapshot() };
    await render(<LearnV2 />);
    expect(text()).toContain("No assignments right now.");
    replies["/api/student/learn"] = { status: 503, body: discovery({ availability: "unavailable" }) };
    await refresh();
    expectEmptyIsHistory();
  });
  it("2. current empty snapshot then network failure/timeout", async () => {
    replies["/api/student/learn"] = { body: emptySnapshot() };
    await render(<LearnV2 />);
    replies["/api/student/learn"] = { reject: true };
    await refresh();
    expectEmptyIsHistory();
  });
  it("3. current empty snapshot then going offline (with and without a failed refresh)", async () => {
    replies["/api/student/learn"] = { body: emptySnapshot() };
    await render(<LearnV2 />);
    await setOnline(false);
    expectEmptyIsHistory();
    replies["/api/student/learn"] = { reject: true };
    await refresh();
    expectEmptyIsHistory();
    expect(text()).toContain("Lists show what was last loaded");
  });
  it("4. not-enrolled snapshot then transient failure", async () => {
    replies["/api/student/learn"] = { body: discovery({ subjects: [], subjectCompletion: [], activeUnits: { availability: "empty", eligibility: "not_enrolled", items: [] } }) };
    await render(<LearnV2 />);
    expect(text()).toContain("You are not enrolled in a class yet");
    replies["/api/student/learn"] = { status: 503, body: discovery({ availability: "unavailable" }) };
    await refresh();
    expect(text()).not.toContain("You are not enrolled in a class yet");
    expect(text()).toContain("When last checked, you were not enrolled in a class. Your current classes could not be checked");
    expect(host.querySelector("[aria-labelledby=my-classes-heading]")!.textContent).toContain("Grade 4A Mathematics");
  });
  it("5. populated snapshot then transient failure keeps rows as last-loaded history", async () => {
    await render(<LearnV2 />);
    replies["/api/student/learn"] = { status: 503, body: discovery({ availability: "unavailable" }) };
    await refresh();
    expect(host.querySelector("a[aria-label='Open assignment: Reading for meaning']")).not.toBeNull();
    expect(text()).toContain("Your assignments could not be checked just now. These are from the last check and may have changed.");
    expect(section("assigned-heading").textContent).toContain("Last loaded");
  });
  it.each([[401, "Signed out"], [403, "Restricted"]])("%i after a prior snapshot clears protected rows (no stale retention)", async (status, badge) => {
    await render(<LearnV2 />);
    expect(host.querySelector("a[aria-label='Open unit: Fractions on a number line']")).not.toBeNull();
    replies["/api/student/learn"] = { status, body: { error: "denied" } };
    await refresh();
    for (const name of ["Reading for meaning", "Fractions check", "Grade 4 reader", "Fractions on a number line"]) expect(text()).not.toContain(name);
    expect(text()).not.toContain("Last checked earlier");
    expect(text()).toContain(badge);
  });
  it.each([[401], [403]])("%i after a prior empty snapshot does not keep its empty claims either", async (status) => {
    replies["/api/student/learn"] = { body: emptySnapshot() };
    await render(<LearnV2 />);
    replies["/api/student/learn"] = { status, body: {} };
    await refresh();
    expect(text()).not.toMatch(CONFIRMED_EMPTY);
    expect(text()).not.toContain("When last checked");
  });
  it("recovery: a successful refresh removes the stale warning and restores current empty copy", async () => {
    replies["/api/student/learn"] = { body: emptySnapshot() };
    await render(<LearnV2 />);
    replies["/api/student/learn"] = { reject: true };
    await refresh();
    expect(text()).toContain("Last checked earlier");
    replies["/api/student/learn"] = { body: emptySnapshot() };
    await refresh();
    expect(text()).not.toContain("Last checked earlier");
    expect(text()).toContain("No assignments right now.");
  });
});

describe("Learn My classes (enrollment authority, not lesson subjects)", () => {
  const block = () => host.querySelector("[aria-labelledby=my-classes-heading]")!;
  const rows = () => [...block().querySelectorAll(".pdv2-row-title")].map((n) => n.textContent);
  const refresh = async () => { await act(async () => { button("Refresh").click(); }); await settle(); };
  it("lists only the classes the authority returned, linking each to its class page", async () => {
    replies["/api/student/classes"] = { body: myClasses([classRow("class-4a", "Grade 4A Mathematics"), classRow("class-4e", "Grade 4 English", { subject: "ENGLISH", teacher: null })]) };
    await render(<LearnV2 />);
    expect(rows()).toEqual(["Grade 4A Mathematics", "Grade 4 English"]);
    expect(block().querySelector("a[aria-label='Open class: Grade 4A Mathematics']")?.getAttribute("href")).toBe("/student/classes/class-4a");
    expect(block().textContent).toContain("Math · Grade 4 · Mr. Kollie");
    expect(block().querySelector("a[href='/student/classes']")).not.toBeNull();
    expect(block().querySelector("a[href='/student/schedule']")).not.toBeNull();
  });
  it("does not invent classes from discovery subjects when the learner has none", async () => {
    replies["/api/student/classes"] = { body: myClasses([]) };
    await render(<LearnV2 />);
    expect(block().textContent).toContain("No classes are listed for you yet.");
    expect(block().querySelectorAll("li").length).toBe(0);
  });
  it("rejects a malformed classes answer as unavailable, never as empty", async () => {
    replies["/api/student/classes"] = { body: myClasses([{ ...classRow("x", "Odd class"), classId: "" }]) };
    await render(<LearnV2 />);
    expect(block().textContent).toContain("Your classes could not load. This does not mean you have none.");
    expect(block().querySelectorAll("li").length).toBe(0);
  });
  describe.each([[401, "Signed out"], [403, "Restricted"]])("authorization failure %i on Refresh", (status, badge) => {
    it("clears current class rows immediately", async () => {
      await render(<LearnV2 />);
      expect(rows()).toEqual(["Grade 4A Mathematics"]);
      replies["/api/student/classes"] = { status, body: { error: "denied" } };
      await refresh();
      expect(rows()).toEqual([]);
      expect(text()).not.toContain("Grade 4A Mathematics");
      expect(block().textContent).toContain(badge);
      expect(block().textContent).not.toContain("Last loaded");
    });
    it("clears an empty-classes snapshot instead of keeping the empty claim", async () => {
      replies["/api/student/classes"] = { body: myClasses([]) };
      await render(<LearnV2 />);
      replies["/api/student/classes"] = { status, body: { error: "denied" } };
      await refresh();
      expect(block().textContent).not.toContain("No classes are listed");
      expect(block().textContent).not.toContain("When last checked");
      expect(block().textContent).toContain(badge);
    });
  });
  it.each([["503", { status: 503, body: {} }], ["network failure", { reject: true }]] as const)("keeps current classes as last-loaded history after a %s", async (_label, reply) => {
    await render(<LearnV2 />);
    replies["/api/student/classes"] = reply;
    await refresh();
    expect(rows()).toEqual(["Grade 4A Mathematics"]);
    expect(block().textContent).toContain("Your classes could not be checked just now. These are from the last check and may have changed.");
    expect(block().textContent).toContain("Last loaded");
  });
  it("recovers to current classes after a transient failure", async () => {
    await render(<LearnV2 />);
    replies["/api/student/classes"] = { status: 503, body: {} };
    await refresh();
    replies["/api/student/classes"] = { body: myClasses([classRow("class-4b", "Grade 4B Mathematics")]) };
    await refresh();
    expect(rows()).toEqual(["Grade 4B Mathematics"]);
    expect(block().textContent).not.toContain("Last loaded");
    expect(block().textContent).not.toContain("could not be checked");
  });
  it("re-checks classes when the device reconnects", async () => {
    await render(<LearnV2 />);
    replies["/api/student/classes"] = { status: 403, body: {} };
    await act(async () => { window.dispatchEvent(new Event("online")); }); await settle();
    expect(rows()).toEqual([]);
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
  const catalogPage = (n: number, items: any[], extra: Record<string, unknown> = {}) => ({ availability: "current", page: n, totalPages: 2, total: 13, count: items.length, items, ...extra });
  it("groups the catalog by subject, shows the server's authorized total and pages", async () => {
    pathname = "/student/lessons";
    replies["/api/student/lessons?page=1"] = { body: catalogPage(1, [{ contentId: "c-1", displayTitle: "Comparing fractions", title: "Comparing fractions", subject: "MATH", grade: 4, href: "/student/lesson/c-1" }]) };
    replies["/api/student/lessons?page=2"] = { body: catalogPage(2, [{ contentId: "c-2", displayTitle: "Reading stories", title: "Reading stories", subject: "ENGLISH", grade: 4, href: "/student/lesson/c-2" }]) };
    await render(<LessonCatalog />);
    expect(headings()).toEqual(["H1:Lesson library", "H2:Math"]);
    expect(text()).toContain("13 lessons available to you");
    await act(async () => { button("Show more lessons").click(); }); await settle();
    expect(headings()).toEqual(["H1:Lesson library", "H2:Math", "H2:English"]);
    expect(host.querySelector("a[aria-label='Open lesson: Reading stories']")?.getAttribute("href")).toBe("/student/lesson/c-2");
  });
  it("shows a server-confirmed empty catalog as empty", async () => {
    replies["/api/student/lessons"] = { body: catalogPage(1, [], { totalPages: 0, total: 0 }) };
    await render(<LessonCatalog />);
    expect(text()).toContain("No lessons are published for your grade yet.");
  });
  it("shows a server-unavailable catalog as unavailable, not empty", async () => {
    replies["/api/student/lessons"] = { body: catalogPage(1, [], { availability: "unavailable", totalPages: 0, total: 0 }) };
    await render(<LessonCatalog />);
    expect(text()).toContain("Your lessons are unavailable right now.");
    expect(text()).not.toContain("No lessons are published");
  });
  it("shows a catalog request failure with retry, not 'no lessons'", async () => {
    replies["/api/student/lessons"] = { status: 503, body: { error: "Lessons unavailable", availability: "unavailable" } };
    await render(<LessonCatalog />);
    expect(text()).toContain("Unavailable");
    expect(text()).not.toContain("No lessons are published");
  });
  it.each([
    [{ availability: "empty", eligibility: "not_enrolled", items: [] }, "You are not enrolled in a class yet"],
    [{ availability: "empty", eligibility: "eligible", items: [] }, "No units are scheduled for your class this week."],
    [{ availability: "unavailable", eligibility: "unavailable", items: [] }, "Units are unavailable right now."],
  ])("this-week units consume the server envelope (%o)", async (body, copy) => {
    replies["/api/student/units/active"] = { body };
    await render(<ThisWeeksUnits />);
    expect(text()).toContain(copy);
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
  });
  it.each([[404, "This unit isn't available"], [403, "Restricted"], [500, "Try again"]])("unit %i is presented honestly", async (status, copy) => {
    replies["/api/student/units/u-9"] = { status, body: {} };
    await render(<UnitOverviewClient unitId="u-9" />);
    expect(text()).toContain(copy);
  });
});
