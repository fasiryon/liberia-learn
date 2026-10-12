// @vitest-environment jsdom
// Demo showcase labs, converged: Codex's server authority (lib/student/showcaseLabs.ts) decides; the Labs hub
// shows granted labs once in their own section and the lab route opens them with a Back to Labs path.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

const db = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  labSession: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  masteryRecord: { upsert: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
const auth = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireRole: auth }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: vi.fn(async () => []) }));

import StudentLabsPage from "@/app/student/labs/page";
import StudentLabDetailPage from "@/app/student/labs/[labId]/page";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
import { SHOWCASE_LAB_IDS } from "@/lib/student/showcaseLabs";
import { classifyLabExperience, findLabExperience, listLabExperiences } from "@/lib/learner-experience/labExperience";

const TITLES = { "g4-solid-figures": "Solid figures", "fixture-lever": "Lever", "fixture-simple-circuit": "Simple circuit", "mount-coffee-hydropower": "Mount Coffee hydropower" } as const;
const demoUser = { id: "seeded-user", role: "STUDENT", schoolId: "cha-high-academy" };
const demoAccount = { ...demoUser, email: process.env.E2E_DEMO_STUDENT_EMAIL ?? "student1@cha.edu.lr", loginId: "CHA-2026-0001" };
const demoStudent = { id: "seeded-student", userId: demoUser.id, currentGrade: 6, user: demoAccount };
const normalUser = { id: "pilot-user", role: "STUDENT", schoolId: "pilot-school" };
const SHOWCASE = 'section[aria-labelledby="showcase-labs-title"]';
const LIBRARY = 'section[aria-labelledby="labs-section-title"]';

function asDemo() { auth.mockResolvedValue(demoUser); db.student.findUnique.mockResolvedValue(demoStudent); }
function asNormal() { auth.mockResolvedValue(normalUser); db.student.findUnique.mockResolvedValue({ id: "pilot-student", userId: normalUser.id, currentGrade: 6, user: { ...normalUser, email: "learner@pilot.lr", loginId: "P-1" } }); }
async function hub(tab?: string) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(await StudentLabsPage({ searchParams: tab ? { tab } : {} }));
  return host;
}
async function detail(labId: string) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(await StudentLabDetailPage({ params: { labId } }));
  return host;
}
const labHrefs = (root: Element | null) => root ? [...root.querySelectorAll<HTMLAnchorElement>('a[href^="/student/labs/"]')].map((a) => a.getAttribute("href")) : [];
const backHref = (host: HTMLElement) => [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Back to Labs"))?.getAttribute("href");
const persistenceCalls = () => [...Object.values(db.labSession), ...Object.values(db.masteryRecord)].reduce((n, fn) => n + fn.mock.calls.length, 0);

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
beforeEach(() => { vi.clearAllMocks(); asDemo(); });

describe("A. authorized demo student", () => {
  it("sees exactly the four showcase labs once, with registered titles and Open actions", async () => {
    const host = await hub();
    const cards = [...host.querySelector(SHOWCASE)!.querySelectorAll("article")];
    expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual(Object.values(TITLES));
    for (const card of cards) {
      expect(card.textContent).toContain("Showcase Lab");
      expect(card.querySelector("a")?.textContent).toMatch(/^Open lab: /);
    }
    expect(labHrefs(host.querySelector(SHOWCASE))).toEqual(SHOWCASE_LAB_IDS.map((id) => `/student/labs/${id}`));
    // Every showcase link on the page appears exactly once.
    expect(labHrefs(host)).toEqual(SHOWCASE_LAB_IDS.map((id) => `/student/labs/${id}`));
  });

  it.each(["for-you", "assigned", "continue", "library", "completed"])("the %s tab never repeats a showcase lab", async (tab) => {
    const host = await hub(tab);
    expect(host.querySelectorAll(`${SHOWCASE} article`)).toHaveLength(4);
    expect(labHrefs(host.querySelector(LIBRARY))).toEqual([]);
  });

  it("never claims release, assignment, approval or lesson linkage", async () => {
    const text = (await hub()).querySelector(SHOWCASE)!.textContent!;
    expect(text).not.toMatch(/Released|Approved|Assigned|Ministry|Supports an objective/i);
    expect(text).toContain("not linked to your lessons");
  });
});

describe("B. normal learner", () => {
  beforeEach(asNormal);

  it("has no showcase section and the production tabs are unchanged", async () => {
    const host = await hub();
    expect(host.querySelector(SHOWCASE)).toBeNull();
    expect(labHrefs(host)).toEqual([]);
    expect([...host.querySelectorAll('nav[aria-label="Lab sections"] a')].map((a) => a.textContent)).toEqual(["For You0", "Assigned0", "Continue0", "Library0", "Completed0"]);
    expect(host.textContent).toContain("No released labs are available for your classes yet.");
  });

  it("a failed identity read denies without breaking the hub", async () => {
    asDemo();
    // Only the showcase identity read (it selects the linked user) fails; the hub's grade read still works.
    db.student.findUnique.mockImplementation(async (args: { select?: { user?: unknown } }) => {
      if (args.select?.user) throw new Error("database unavailable");
      return { currentGrade: 6 };
    });
    const host = await hub();
    expect(host.querySelector(SHOWCASE)).toBeNull();
    expect(host.textContent).not.toContain("Unable to load labs.");
  });
});

describe("C/D. direct showcase routes", () => {
  it.each(SHOWCASE_LAB_IDS)("C. %s opens for the demo student with a Back to Labs path", async (labId) => {
    const host = await detail(labId);
    expect(host.textContent).not.toContain("This lab is not available.");
    expect(host.textContent).toContain(TITLES[labId]);
    expect(backHref(host)).toBe("/student/labs");
  });

  it.each(SHOWCASE_LAB_IDS)("D. %s stays closed for a normal student, with a way back", async (labId) => {
    asNormal();
    const host = await detail(labId);
    expect(host.textContent).toContain("This lab is not available.");
    expect(host.textContent).not.toContain("Start exploring");
    expect(backHref(host)).toBe("/student/labs");
  });
});

describe("E. legacy labs stay blocked for the demo student", () => {
  const legacy = listLabExperiences().filter((lab) => lab.runtime.kind === "LEGACY_SIMULATION");

  it("all 12 are absent from the hub and stay LEGACY_UNCERTIFIED", async () => {
    expect(legacy).toHaveLength(12);
    const hrefs = labHrefs(await hub("library"));
    for (const lab of legacy) {
      expect(hrefs).not.toContain(`/student/labs/${lab.labId}`);
      expect(classifyLabExperience(lab)).toBe("LEGACY_UNCERTIFIED");
    }
  });

  it.each(legacy.map((lab) => lab.labId))("%s does not open through the showcase route", async (labId) => {
    const host = await detail(labId);
    expect(host.textContent).not.toContain("Start exploring");
    expect(host.textContent).toContain("No lab session was found for this assignment.");
  });
});

describe("F. showcase interaction has no persistence path", () => {
  it.each(SHOWCASE_LAB_IDS)("%s: opening and using it writes no session, mastery or evidence", async (labId) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    try {
      await detail(labId);
      const host = document.createElement("div");
      const root = createRoot(host);
      await act(async () => { root.render(<InteractiveLabPlayer labId={labId} internalPreview override="FALLBACK_2D" />); });
      const start = [...host.querySelectorAll("button")].find((button) => button.textContent === "Start exploring")!;
      await act(async () => { start.click(); });
      for (const button of [...host.querySelectorAll("button")].slice(0, 6)) await act(async () => { button.click(); });
      act(() => root.unmount());
      expect(fetch).not.toHaveBeenCalled();
      expect(persistenceCalls()).toBe(0);
    } finally { vi.unstubAllGlobals(); }
  });

  it("the player alone refuses unreleased labs: internalPreview is only set after the route authorizes", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => { root.render(<InteractiveLabPlayer labId="fixture-simple-circuit" />); });
    expect(host.textContent).toContain("This lab is not available.");
    act(() => root.unmount());
  });

  it("production governance is unchanged", () => {
    for (const labId of SHOWCASE_LAB_IDS) expect(classifyLabExperience(findLabExperience(labId)!)).toBe("UNRELEASED");
    expect(listLabExperiences().filter((lab) => classifyLabExperience(lab) === "CERTIFIED_RELEASED")).toEqual([]);
    expect(findLabExperience("mount-coffee-hydropower")!.release).toMatchObject({ status: "DRAFT_UNRELEASED", curriculumActive: false });
  });
});
