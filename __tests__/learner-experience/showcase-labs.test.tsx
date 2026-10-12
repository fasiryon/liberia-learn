// @vitest-environment jsdom
// Demo showcase labs: the Labs hub and lab route honour the server grant exactly, and nothing else.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { ShowcaseLabAccess } from "@/lib/student/showcaseLabAccess";

const access = vi.hoisted(() => ({ load: vi.fn<(user: unknown) => Promise<ShowcaseLabAccess>>() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "user-a", role: "STUDENT", schoolId: "school-a" })) }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: vi.fn(async () => ({ currentGrade: 6 })) } } }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: vi.fn(async () => []) }));
vi.mock("@/lib/student/showcaseLabAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/student/showcaseLabAccess")>()),
  loadShowcaseLabAccess: access.load,
}));

import StudentLabsPage from "@/app/student/labs/page";
import StudentLabDetailPage from "@/app/student/labs/[labId]/page";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
import { SHOWCASE_LAB_IDS } from "@/lib/student/showcaseLabAccess";
import { classifyLabExperience, findLabExperience } from "@/lib/learner-experience/labExperience";

const FULL_GRANT: ShowcaseLabAccess = { authorized: true, labIds: [...SHOWCASE_LAB_IDS] };
const TITLES = { "g4-solid-figures": "Solid figures", "fixture-lever": "Lever", "fixture-simple-circuit": "Simple circuit", "mount-coffee-hydropower": "Mount Coffee hydropower" } as const;

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
const openHrefs = (host: HTMLElement) => [...host.querySelectorAll<HTMLAnchorElement>('a[href^="/student/labs/"]')].map((a) => a.getAttribute("href"));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

describe("authorized demo response", () => {
  beforeEach(() => access.load.mockResolvedValue(FULL_GRANT));

  it("shows all four showcase labs with their registered titles and an Open action each", async () => {
    const host = await hub();
    const section = host.querySelector('section[aria-labelledby="showcase-labs-title"]')!;
    expect(section).not.toBeNull();
    const cards = [...section.querySelectorAll("article")];
    expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual(Object.values(TITLES));
    for (const card of cards) {
      expect(card.textContent).toContain("Showcase Lab");
      expect(card.querySelector("a")?.textContent).toMatch(/^Open lab: /);
    }
    expect(openHrefs(section as HTMLElement)).toEqual(SHOWCASE_LAB_IDS.map((id) => `/student/labs/${id}`));
  });

  it("never claims release, assignment, approval or lesson linkage", async () => {
    const text = (await hub()).querySelector('section[aria-labelledby="showcase-labs-title"]')!.textContent!;
    expect(text).not.toMatch(/Released|Approved|Assigned|Ministry|Supports an objective/i);
    expect(text).toContain("not linked to your lessons");
  });

  it("is discoverable from every Labs tab", async () => {
    for (const tab of ["for-you", "assigned", "continue", "library", "completed"]) {
      expect((await hub(tab)).querySelectorAll('section[aria-labelledby="showcase-labs-title"] article')).toHaveLength(4);
    }
  });

  it.each(SHOWCASE_LAB_IDS)("%s opens in the interactive runtime with a Back to Labs path", async (labId) => {
    const host = await detail(labId);
    expect(host.textContent).not.toContain("This lab is not available.");
    expect(host.textContent).toContain(TITLES[labId]);
    const back = [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Back to Labs"));
    expect(back?.getAttribute("href")).toBe("/student/labs");
  });

  it("does not change any production classification", () => {
    for (const labId of SHOWCASE_LAB_IDS) expect(classifyLabExperience(findLabExperience(labId)!)).toBe("UNRELEASED");
  });
});

describe("normal learner response", () => {
  beforeEach(() => access.load.mockResolvedValue({ authorized: false, labIds: [] }));

  it("renders no showcase section and no openable showcase lab", async () => {
    const host = await hub("library");
    expect(host.querySelector('section[aria-labelledby="showcase-labs-title"]')).toBeNull();
    for (const id of SHOWCASE_LAB_IDS) expect(openHrefs(host)).not.toContain(`/student/labs/${id}`);
    expect(host.textContent).toContain("No released labs are available for your classes yet.");
  });

  it.each(SHOWCASE_LAB_IDS)("%s stays closed on the lab route, with a way back", async (labId) => {
    const host = await detail(labId);
    expect(host.textContent).toContain("This lab is not available.");
    expect([...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Back to Labs"))?.getAttribute("href")).toBe("/student/labs");
  });
});

describe("server denial is final", () => {
  it("authorized:false wins over a populated lab list", async () => {
    access.load.mockResolvedValue({ authorized: false, labIds: [...SHOWCASE_LAB_IDS] });
    expect((await hub()).querySelector('section[aria-labelledby="showcase-labs-title"]')).toBeNull();
    expect((await detail("fixture-lever")).textContent).toContain("This lab is not available.");
  });

  it("a partial grant exposes only the granted lab", async () => {
    access.load.mockResolvedValue({ authorized: true, labIds: ["fixture-simple-circuit"] });
    expect(openHrefs((await hub()).querySelector('section[aria-labelledby="showcase-labs-title"]') as HTMLElement)).toEqual(["/student/labs/fixture-simple-circuit"]);
    expect((await detail("fixture-simple-circuit")).textContent).not.toContain("This lab is not available.");
    expect((await detail("mount-coffee-hydropower")).textContent).toContain("This lab is not available.");
  });

  it("a grant cannot reach labs outside the showcase list", async () => {
    access.load.mockResolvedValue({ authorized: true, labIds: ["human-heart", "unknown-lab"] });
    expect((await hub()).querySelector('section[aria-labelledby="showcase-labs-title"]')).toBeNull();
  });

  it("a failed grant check denies access without breaking the hub", async () => {
    access.load.mockImplementation(async () => { throw new Error("authority unavailable"); });
    const host = await hub();
    expect(host.querySelector('section[aria-labelledby="showcase-labs-title"]')).toBeNull();
    expect(host.textContent).not.toContain("Unable to load labs.");
    expect((await detail("g4-solid-figures")).textContent).toContain("This lab is not available.");
  });
});

describe("showcase player", () => {
  it("is interactive only when the route passes the server grant", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => { root.render(<InteractiveLabPlayer labId="fixture-simple-circuit" />); });
    expect(host.textContent).toContain("This lab is not available.");
    await act(async () => { root.render(<InteractiveLabPlayer labId="fixture-simple-circuit" internalPreview />); });
    expect(host.textContent).toContain("Simple circuit");
    expect(host.querySelectorAll("button").length).toBeGreaterThan(0);
    act(() => root.unmount());
  });
});
