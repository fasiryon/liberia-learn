// @vitest-environment jsdom
// Curriculum V2 → Lesson Player V2: a generated G4 artifact renders and navigates in the real player component.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/learner-experience/progressStore", () => ({ loadExperienceProgress: async () => null, saveExperienceProgress: async () => undefined }));
vi.mock("@/components/toolkit/toolComponents", () => ({ TOOL_COMPONENTS: {} }));

import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { lessonLinks, toLessonExperience } from "@/lib/curriculum/v2/compat";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import type { AgeBand } from "@/lib/learner-experience/types";

let root: Root | null = null;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; });

describe("Lesson Player V2 plays Curriculum V2 output", () => {
  it("renders the generated fractions lesson scene by scene with formative feedback", async () => {
    const outcome = runG4Proof("equivalent-fractions.json", "moe-math-g4-s1-p3-number-theory-and-fraction-obj5");
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    const experience = toLessonExperience(outcome.lesson);
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(<LessonPlayerV2 experience={experience} links={lessonLinks(outcome.lesson)} labs={{}} toolsByScene={{}} basePath="/lab-review/experience" exitHref="/student/learn" returnSceneId={null} />);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("Scene 1 of 9");
    expect(host.textContent).toContain("Who got more cassava bread?");
    const next = () => Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.trim().startsWith("Continue")) as HTMLButtonElement;
    await act(async () => { next().click(); });
    expect(host.textContent).toContain("Scene 2 of 9");
    expect(host.textContent).not.toContain("expectedObservation");
    host.remove();
  });
});

// Codex second-pass P1-4: a fallback that became part of a scene's text must reach the learner in
// whichever age band the player selects, not only in the default body.
describe("Lesson Player V2 delivers scene fallbacks in every age band", () => {
  const BANDS: AgeBand[] = ["EARLY_PRIMARY", "UPPER_PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
  const DRAW = "Draw the graph on squared paper";
  const WRITE = "Write each fruit and the number its bar shows";

  function barGraphsWithBands() {
    const outcome = runG4Proof("bar-graphs.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj6");
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    const lesson = JSON.parse(JSON.stringify(outcome.lesson));
    for (const id of ["read-graph", "match-bars"]) {
      const scene = lesson.scenes.find((candidate: { id: string }) => candidate.id === id);
      scene.content.ageVariants = Object.fromEntries(BANDS.map((band) => [band, { body: `${band} wording for ${id}.` }]));
    }
    return lesson;
  }

  async function renderAt(lesson: any, band: AgeBand, title: string): Promise<HTMLElement> {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(<LessonPlayerV2 experience={toLessonExperience(lesson)} links={lessonLinks(lesson)} labs={{}} toolsByScene={{}} basePath="/lab-review/experience" exitHref="/student/learn" returnSceneId={null} ageBand={band} />);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    for (let step = 0; step < 6 && host.querySelector("h1, h2")?.textContent?.trim() !== title; step++) {
      const next = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.trim().startsWith("Continue")) as HTMLButtonElement | undefined;
      if (!next || next.disabled) break;
      await act(async () => { next.click(); });
    }
    expect(host.textContent).toContain(title);
    return host;
  }

  it.each(BANDS)("required media the player cannot show: %s wording carries the text walkthrough", async (band) => {
    const host = await renderAt(barGraphsWithBands(), band, "The bar graph");
    expect(host.textContent).toContain(`${band} wording for read-graph.`);
    expect(host.textContent).toContain(DRAW);
    host.remove();
  });

  it.each(BANDS)("unrendered interaction with a free-response fallback: %s still gets the written response", async (band) => {
    const host = await renderAt(barGraphsWithBands(), band, "Match each fruit to its count");
    expect(host.textContent).toContain(`${band} wording for match-bars.`);
    expect(host.textContent).toContain(WRITE);
    expect(host.querySelector("textarea")).not.toBeNull();
    // Rendered as the interaction, so it is not also appended to the band wording.
    expect(host.textContent!.split(WRITE).length - 1).toBe(1);
    host.remove();
  });

  it("does not append a fallback to band wording when the scene is delivered as authored", () => {
    const experience = toLessonExperience(barGraphsWithBands());
    const intro = experience.scenes.find((scene) => scene.id === "match-bars")!;
    for (const band of BANDS) expect(intro.content.ageVariants?.[band]?.body).toBe(`${band} wording for match-bars.`);
  });
});
