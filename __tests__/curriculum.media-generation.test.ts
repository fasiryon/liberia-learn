import { describe, expect, it } from "vitest";
import {
  generateMediaArtifacts,
  generateMediaArtifactsBestEffort,
} from "@/lib/curriculum/mediaGeneration";

describe("curriculum media generation", () => {
  it("creates typed media artifacts for a validated lesson blueprint", () => {
    const result = generateMediaArtifacts({
      sourceLessonId: "lesson-1",
      subject: "MATH",
      grade: 7,
      unitTitle: "Fractions and Ratio",
      lessonTitle: "Comparing Fractions",
      objective: "Students compare fractions accurately.",
      teacherExplanation: "Use benchmarks, number lines, and equivalence.",
      workedExamples: ["Compare 3/4 and 5/8."],
      guidedPractice: ["Compare 2/3 and 3/5."],
      groupWorkTask: "Create a fraction strategy poster.",
      guardianSupportNote: "Ask your child to explain one comparison method.",
      homePracticeSuggestion: "Compare food portions at home.",
      realWorldApplication: "Useful for cooking and trade quantities.",
      digitalConnection: "Use a fraction visualizer when devices exist.",
      materialsNeeded: ["paper strips", "exercise books"],
    });

    expect(result.mediaGenerationStatus).toBe("ready");
    expect(result.visualAssetSpecs[0].sourceLessonId).toBe("lesson-1");
    expect(result.audioScriptSpecs[0].mode).toBe("teacher_narration");
    expect(result.slideDeckSpecs[0].exportIntent).toBe("pptx_compatible");
    expect(result.videoStoryboardSpecs[0].scenes.length).toBeGreaterThanOrEqual(3);
    expect(result.labDefinitionSpecs[0].threeDReady).toBe(true);
    expect(result.pseudoLabs[0].renderStatus).toBe("ready");
    expect(result.simulationDefinitions[0].approved).toBe(true);
  });

  it("degrades cleanly when media generation throws", () => {
    const brokenInput = new Proxy(
      {},
      {
        get() {
          throw new Error("media boom");
        },
      }
    ) as any;

    const result = generateMediaArtifactsBestEffort(brokenInput);
    expect(result.mediaGenerationStatus).toBe("deferred");
    expect(result.mediaGenerationErrors[0]).toContain("media boom");
    expect(result.visualAssetSpecs).toHaveLength(0);
  });
});
