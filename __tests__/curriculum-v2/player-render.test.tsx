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
