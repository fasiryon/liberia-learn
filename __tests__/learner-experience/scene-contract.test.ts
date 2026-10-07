import { describe, expect, it } from "vitest";
import { hydropowerLessonExperience as lesson, hydropowerLabLink as link } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { resolveLessonScenes, SceneContractError, validateLessonExperience, wordCount, sceneBodyFor } from "@/lib/learner-experience/sceneContract";
import { parseToSlides } from "@/lib/lessons/parseToSlides";
import type { LessonExperience } from "@/lib/learner-experience/types";

const LONG_BODY = Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}: ${"moving water turns the turbine and the generator makes electricity ".repeat(8)}`).join(" ");

describe("Lesson Player V2 scene contract", () => {
  it("validates the native hydroelectric prototype and renders multiple scenes", () => {
    expect(() => validateLessonExperience(lesson)).not.toThrow();
    const resolved = resolveLessonScenes({ title: lesson.title, native: lesson });
    expect(resolved.source).toBe("NATIVE_SCENES");
    expect(resolved.scenes.length).toBe(9);
    expect(resolved.scenes.map((scene) => scene.type)).toEqual(["INTRO", "OBJECTIVE", "EXPLANATION", "INTERACTIVE_DIAGRAM", "CHECK_UNDERSTANDING", "LAB", "REFLECTION", "REVIEW", "MASTERY_CHECK"]);
  });

  it("keeps every native scene focused (no giant page)", () => {
    for (const scene of lesson.scenes) expect(wordCount(scene.content.body)).toBeLessThanOrEqual(350);
  });

  it("native scenes win over a long legacy body that parseToSlides would collapse into one slide", () => {
    // A single unbroken paragraph has no instructional boundaries for the fallback parser to find.
    const slides = parseToSlides({ title: "Hydro", content: LONG_BODY });
    const giant = slides.find((slide) => wordCount(slide.content) > 350);
    expect(giant).toBeDefined();
    const resolved = resolveLessonScenes({ title: "Hydro", native: lesson, legacyBody: LONG_BODY });
    expect(resolved.source).toBe("NATIVE_SCENES");
    expect(resolved.scenes.every((scene) => wordCount(scene.body) <= 350)).toBe(true);
  });

  it("walks the migration hierarchy: governed sections, then parsed slides, then read mode", () => {
    expect(resolveLessonScenes({ title: "T", governedSections: { learnerMaterial: "Read this.", guidedItems: ["a"], independentItems: ["b"], masteryTask: "Do it." }, legacyBody: "## A\n\nx\n\n## B\n\ny" }).source).toBe("GOVERNED_SECTIONS");
    expect(resolveLessonScenes({ title: "T", legacyBody: "## A\n\nx\n\n## B\n\ny" }).source).toBe("PARSED_SLIDES_FALLBACK");
    expect(resolveLessonScenes({ title: "T" }).source).toBe("LEGACY_READ_MODE");
  });

  it("rejects contract violations", () => {
    const mutate = (change: (scenes: LessonExperience["scenes"][number][]) => void): LessonExperience => {
      const scenes = lesson.scenes.map((scene) => ({ ...scene }));
      change(scenes);
      return { ...lesson, scenes };
    };
    const expectError = (experience: LessonExperience, code: string) => {
      expect(() => validateLessonExperience(experience)).toThrow(SceneContractError);
      expect(() => validateLessonExperience(experience)).toThrow(code);
    };
    expectError(mutate((s) => { s[2] = { ...s[2], content: { body: LONG_BODY } }; }), "scene_too_long");
    expectError(mutate((s) => { s[2] = { ...s[2], tools: { allowed: ["laser-cutter"], prohibited: [] } }; }), "scene_tool_unknown");
    expectError(mutate((s) => { s[2] = { ...s[2], accessibility: { ...s[2].accessibility, textAlternative: " " } }; }), "scene_text_alternative_required");
    expectError(mutate((s) => { s[1] = { ...s[1], id: s[0].id }; }), "scene_id_duplicate");
    expectError(mutate((s) => { s[3] = { ...s[3], completion: { kind: "ALL_ANSWERED" } }; }), "scene_completion_mismatch");
    expectError(mutate((s) => { s[8] = { ...s[8], interaction: { kind: "NONE" }, completion: { kind: "VIEWED" } }; }), "scene_mastery_requires_assessment_handoff");
    expectError({ ...lesson, scenes: lesson.scenes.slice(0, 1) }, "experience_requires_multiple_scenes");
  });

  it("never ships a mastery answer key to the client", () => {
    const mastery = lesson.scenes.find((scene) => scene.type === "MASTERY_CHECK")!;
    expect(mastery.interaction.kind).toBe("ASSESSMENT_HANDOFF");
    expect(JSON.stringify(mastery)).not.toMatch(/correctIndex|answerKey/);
  });

  it("adapts presentation by age band without changing the objective or interaction", () => {
    const explain = lesson.scenes.find((scene) => scene.id === "explain")!;
    expect(sceneBodyFor(explain, "UPPER_PRIMARY").body).not.toBe(sceneBodyFor(explain, "JUNIOR_SECONDARY").body);
    expect(sceneBodyFor(explain, "SENIOR_SECONDARY").body).toBe(explain.content.body);
  });

  it("is marked as an internal prototype, never approved curriculum", () => {
    expect(lesson.authority.status).toBe("PROTOTYPE_FIXTURE");
    expect(lesson.authority.releaseId).toBeNull();
    expect(link.status).toBe("PROTOTYPE_INTERNAL");
    expect(link.authority.approvedBy).toBeNull();
  });
});
