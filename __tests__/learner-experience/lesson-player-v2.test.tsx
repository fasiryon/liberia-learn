// @vitest-environment jsdom
// Product Redesign V1 Phase A: Lesson Player V2 renders focused scenes, navigates, resumes, launches a lab with
// origin context and restores the originating scene on return.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const push = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/learner-experience/progressStore", () => ({
  loadExperienceProgress: async (id: string) => store.get(id) ?? null,
  saveExperienceProgress: async (progress: { experienceId: string }) => { store.set(progress.experienceId, JSON.parse(JSON.stringify(progress))); },
}));
vi.mock("@/components/toolkit/toolComponents", () => ({ TOOL_COMPONENTS: {} }));

import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { LESSON_EXPERIENCES, HYDROPOWER_EXPERIENCE_ID } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import { labReturnStorageKey, parseLabLaunchContext } from "@/lib/learner-experience/labLaunch";

const { experience, links } = LESSON_EXPERIENCES[HYDROPOWER_EXPERIENCE_ID];
const labs = { "mount-coffee-hydropower": findLabExperience("mount-coffee-hydropower")! };
let root: Root | null = null;
let host: HTMLDivElement;

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { store.clear(); push.mockReset(); window.sessionStorage.clear(); host = document.createElement("div"); document.body.appendChild(host); });
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); });

async function render(returnSceneId: string | null = null) {
  await act(async () => {
    root = createRoot(host);
    root.render(<LessonPlayerV2 experience={experience} links={links} labs={labs} toolsByScene={{}} basePath="/lab-review/experience" exitHref="/student/learn" returnSceneId={returnSceneId} />);
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
const sceneId = () => host.querySelector("[data-lesson-player-v2]")?.getAttribute("data-scene-id");
const button = (label: string) => Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim().startsWith(label)) as HTMLButtonElement;
const click = async (element: HTMLElement) => { await act(async () => { element.click(); }); };

describe("Lesson Player V2", () => {
  it("shows one focused scene at a time with scene X of Y, and Previous/Continue", async () => {
    await render();
    expect(sceneId()).toBe("intro");
    expect(host.textContent).toContain("Scene 1 of 9");
    expect(host.querySelectorAll("article").length).toBe(1);
    expect(button("Previous").disabled).toBe(true);
    await click(button("Continue"));
    expect(sceneId()).toBe("objective");
    expect(host.textContent).toContain("Scene 2 of 9");
    await click(button("Previous"));
    expect(sceneId()).toBe("intro");
  });

  it("blocks Continue until the scene's completion rule is met", async () => {
    store.set(experience.id, { v: 1, experienceId: experience.id, experienceVersion: experience.version, sceneId: "energy-chain", completedSceneIds: ["intro", "objective", "explain"], responses: {}, revealed: {}, lab: { status: "NOT_STARTED", observation: null }, updatedAt: "2026-10-07T00:00:00.000Z" });
    await render();
    expect(sceneId()).toBe("energy-chain");
    expect(button("Continue").disabled).toBe(true);
    expect(host.textContent).toContain("Open every stage of the diagram to continue.");
    for (const label of ["Headpond", "Penstock", "Turbine and shaft", "Generator", "Grid and city"]) {
      const step = Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label)) as HTMLButtonElement;
      await click(step);
    }
    expect(button("Continue").disabled).toBe(false);
  });

  it("resumes at the saved scene", async () => {
    store.set(experience.id, { v: 1, experienceId: experience.id, experienceVersion: experience.version, sceneId: "review", completedSceneIds: [], responses: {}, revealed: {}, lab: { status: "NOT_STARTED", observation: null }, updatedAt: "2026-10-07T00:00:00.000Z" });
    await render();
    expect(sceneId()).toBe("review");
  });

  it("Explore in Lab launches with origin context; returning restores the lab scene with the lab summary", async () => {
    store.set(experience.id, { v: 1, experienceId: experience.id, experienceVersion: experience.version, sceneId: "lab", completedSceneIds: [], responses: {}, revealed: {}, lab: { status: "NOT_STARTED", observation: null }, updatedAt: "2026-10-07T00:00:00.000Z" });
    await render();
    await click(button("Explore in Lab"));
    expect(push).toHaveBeenCalledTimes(1);
    const href = push.mock.calls[0][0] as string;
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe(`/lab-review/experience/${experience.id}/lab/mount-coffee-hydropower`);
    const context = parseLabLaunchContext("mount-coffee-hydropower", Object.fromEntries(url.searchParams.entries()))!;
    expect(context.origin).toMatchObject({ experienceId: experience.id, sceneId: "lab", objectiveIds: ["hydropower-cause-and-effect"] });
    act(() => root?.unmount()); root = null;

    // The lab hands back a summary; the lesson reopens on the originating scene.
    store.set(experience.id, { ...(store.get(experience.id) as object), sceneId: "intro" });
    window.sessionStorage.setItem(labReturnStorageKey(experience.id), JSON.stringify({ labId: "mount-coffee-hydropower", labVersion: "1.1.0", linkId: links[0].linkId, completedCheckIds: ["trace-water"], totalChecks: 5, tripObserved: true, resetObserved: true, finalProfile: "LOW", minutesInLab: 4, exit: "RETURNED_EARLY" }));
    await render("lab");
    expect(sceneId()).toBe("lab");
    expect(host.textContent).toContain("Welcome back");
    expect(host.textContent).toContain("You saw the plant trip.");
    expect(button("Continue").disabled).toBe(false);
  });

  it("a reload of an old return URL keeps the learner's later position", async () => {
    store.set(experience.id, { v: 1, experienceId: experience.id, experienceVersion: experience.version, sceneId: "mastery", completedSceneIds: [], responses: {}, revealed: {}, lab: { status: "RETURNED", observation: null }, updatedAt: "2026-10-07T00:00:00.000Z" });
    await render("lab");
    expect(sceneId()).toBe("mastery");
  });

  it("keeps focus in the reflection box while the learner types (focus moves only on scene change)", async () => {
    store.set(experience.id, { v: 1, experienceId: experience.id, experienceVersion: experience.version, sceneId: "reflection", completedSceneIds: [], responses: {}, revealed: {}, lab: { status: "RETURNED", observation: null }, updatedAt: "2026-10-07T00:00:00.000Z" });
    await render();
    const box = host.querySelector("#reflect-why-trip") as HTMLTextAreaElement;
    box.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    for (const text of ["T", "Th", "The"]) {
      await act(async () => { setter.call(box, text); box.dispatchEvent(new Event("input", { bubbles: true })); });
      expect(document.activeElement).toBe(box);
    }
    await act(async () => { setter.call(box, "The city asked for too much power."); box.dispatchEvent(new Event("input", { bubbles: true })); });
    const other = host.querySelector("#reflect-before-reset") as HTMLTextAreaElement;
    await act(async () => { setter.call(other, "Switch off some shops blocks first."); other.dispatchEvent(new Event("input", { bubbles: true })); });
    await click(button("Continue"));
    expect(sceneId()).toBe("review");
    expect(document.activeElement?.id).toBe("scene-title");
  });

  it("restores the lab scene from a valid hand-back even if IndexedDB lost the launch marker", async () => {
    window.sessionStorage.setItem(labReturnStorageKey(experience.id), JSON.stringify({ labId: "mount-coffee-hydropower", labVersion: "1.1.0", linkId: links[0].linkId, completedCheckIds: [], totalChecks: 5, tripObserved: false, resetObserved: false, finalProfile: "LOW", minutesInLab: 1, exit: "RETURNED_EARLY" }));
    await render("lab");
    expect(sceneId()).toBe("lab");
    expect(host.textContent).toContain("Welcome back");
  });

  it("ignores a hand-back for a link this lesson did not place", async () => {
    window.sessionStorage.setItem(labReturnStorageKey(experience.id), JSON.stringify({ labId: "g4-solid-figures", labVersion: "2.1.0", linkId: "forged", completedCheckIds: [], totalChecks: 3, tripObserved: false, resetObserved: false, finalProfile: "LOW", minutesInLab: 1, exit: "RETURNED_EARLY" }));
    await render("lab");
    expect(sceneId()).toBe("intro");
  });

  it("offers a non-3D fallback that lets the learner continue", async () => {
    store.set(experience.id, { v: 1, experienceId: experience.id, experienceVersion: experience.version, sceneId: "lab", completedSceneIds: [], responses: {}, revealed: {}, lab: { status: "NOT_STARTED", observation: null }, updatedAt: "2026-10-07T00:00:00.000Z" });
    await render();
    expect(button("Continue").disabled).toBe(true);
    await click(button("I read the walkthrough"));
    expect(button("Continue").disabled).toBe(false);
  });
});
