// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const history = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/learner-experience/progressStore", () => ({ loadExperienceProgress: history.load, saveExperienceProgress: history.save }));
vi.mock("@/components/toolkit/toolComponents", () => ({ TOOL_COMPONENTS: {} }));
import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { loadDraft6Review } from "@/lib/curriculum/v4/draft6Review";
import { pilotExperience } from "@/lib/curriculum/v4/learningPreview";

it("keeps pilot progress in memory and finishes without constructing or submitting evidence", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const loaded = pilotExperience(loadDraft6Review("factory@4.0.0-draft.6@g7-math-area-perimeter").experience);
  const experience = { ...loaded, scenes: [loaded.scenes[0], loaded.scenes[loaded.scenes.length - 1]] };
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LessonPlayerV2 experience={experience} toolsByScene={{}} exitHref="/student/lessons" returnSceneId={null} progressStorage="MEMORY" />));
    expect(history.load).not.toHaveBeenCalled(); expect(history.save).not.toHaveBeenCalled();
    const click = async (label: string) => {
      const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent?.trim().startsWith(label));
      expect(button).toBeDefined();
      await act(async () => button?.click());
    };
    await click("Continue");
    expect(host.textContent).toContain("No graded assessment is available");
    await click("Finish");
    expect(host.querySelector('[data-finish-state="PILOT_ONLY"]')).not.toBeNull();
    expect(host.textContent).toContain("Nothing was saved, submitted or graded");
    expect(history.save).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
