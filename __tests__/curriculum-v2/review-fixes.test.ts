// Regression tests for the Phase B independent review findings (secrecy shapes, rendered fallbacks,
// per-option feedback, evidence collectability, writers-off native guard).
import { readFileSync } from "fs";
import { afterEach, describe, expect, it } from "vitest";
import { projectStudentLabPayload, projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { toLessonExperience } from "@/lib/curriculum/v2/compat";
import { runG4Proof, g4ProofContext } from "@/lib/curriculum/v2/g4Proof";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { validateCandidateAgainstContext } from "@/lib/curriculum/v2/validate";
import { sceneDeliverability } from "@/lib/curriculum/v2/deliverability";
import { createCurriculumContent, updateCurriculumContent, upsertCurriculumContent } from "@/lib/curriculum/mutations/repository";
import type { CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";

const lesson = (file: string, objectiveId: string): CurriculumLessonV2 => {
  const outcome = runG4Proof(file, objectiveId);
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return JSON.parse(JSON.stringify(outcome.lesson));
};
const SOLIDS = "moe-math-g4-s2-p6-geometry-and-statistics-obj5";
const AREA = "moe-math-g4-s2-p5-measurement-obj9";
const FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";

describe("learner projection keeps what the runtime needs and nothing else", () => {
  it("keeps the real observation-form shape the lab runtime uses (field, inputType, choices)", () => {
    const lab = projectStudentLabPayload({ title: "Heat", observationForm: [{ field: "temp", prompt: "Temp?", inputType: "choice", choices: ["hot", "cold"], expectedAnswer: "hot" }] });
    expect(lab.observationForm).toEqual([{ field: "temp", prompt: "Temp?", inputType: "choice", choices: ["hot", "cold"] }]);
  });

  it("type-checks top-level lab and problem-set fields so nested secrets cannot ride along", () => {
    const lab = projectStudentLabPayload({ id: { answerKey: "S1" }, title: "Lab", materialsNeeded: [{ expectedResult: "S2" }, "cup"], virtualAlternative: { answer: "S3" }, safetyNotes: { teacherNotes: "S4" } });
    expect(JSON.stringify(lab)).not.toMatch(/S1|S2|S3|S4/);
    expect(lab.materialsNeeded).toEqual(["cup"]);
    const lessonPayload = projectStudentLessonPayload({ body: "Learn this.", problemSets: [{ id: { answerKey: "S5" }, sectionId: { rubric: "S6" }, studentPrompt: "Solve it." }] });
    expect(JSON.stringify(lessonPayload)).not.toMatch(/S5|S6/);
  });

  it("strips answer, solution, mark-scheme and teacher sections at any heading level", () => {
    const body = ["# Lesson", "Learn this.", "## Answer Key", "S7 is 4", "### Worked Solutions", "S8", "## Practice", "Try it.", "### Teacher facilitation notes", "S9", "## Wrap up", "Done."].join("\n");
    const projected = projectStudentLessonPayload({ body });
    expect(JSON.stringify(projected)).not.toMatch(/S7|S8|S9/);
    expect(projected.body).toContain("Try it.");
    expect(projected.body).toContain("Done.");
  });

  it("the AI-literacy rubric is no longer spread onto learner exercises", () => {
    const source = readFileSync("app/api/student/work/[scheduledWorkId]/route.ts", "utf8");
    expect(source).toContain("rawAILiteracyExercises.map(({ rubric: _rubric, ...ex })");
  });

  it("a stored native artifact cannot put an instant-feedback key into a mastery scene", () => {
    const stored = lesson("equivalent-fractions.json", FRACTIONS) as any;
    const mastery = stored.scenes.find((scene: any) => scene.type === "MASTERY_CHECK");
    mastery.interaction = { kind: "SINGLE_CHOICE", items: stored.scenes.find((scene: any) => scene.id === "check").interaction.items };
    mastery.completion = "ALL_ANSWERED";
    expect(projectStudentLessonPayload({ curriculumV2: stored }).studentReady).toBe(false);
    const injected = lesson("equivalent-fractions.json", FRACTIONS) as any;
    injected.assessmentHandoffs[0].governedItems[0].correctIndex = 1;
    const projected = projectStudentLessonPayload({ curriculumV2: injected }) as any;
    const masteryScene = projected.lessonExperience.scenes.find((scene: any) => scene.type === "MASTERY_CHECK");
    expect(JSON.stringify(masteryScene)).not.toContain("correctIndex");
  });
});

describe("compat renders the fallback the review package reports", () => {
  it("an unsupported interaction with a FREE_RESPONSE fallback becomes a real written-response input that keeps its evidence key", () => {
    const experience = toLessonExperience(lesson("area-perimeter.json", AREA));
    const calculate = experience.scenes.find((scene) => scene.id === "calculate")!;
    expect(calculate.interaction.kind).toBe("FREE_RESPONSE");
    expect(calculate.interaction.kind === "FREE_RESPONSE" && calculate.interaction.prompts[0].id).toBe("calculate-both");
    expect(calculate.completion.kind).toBe("ALL_RESPONSES_WRITTEN");
  });

  it("LAB scenes show the declared fallback as their walkthrough; required-media scenes always include it", () => {
    const solids = toLessonExperience(lesson("solid-figures.json", SOLIDS));
    expect(solids.scenes.find((scene) => scene.id === "lab")!.accessibility.textAlternative).toContain("Use real objects instead");
    const bars = toLessonExperience(lesson("bar-graphs.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj6"));
    expect(bars.scenes.find((scene) => scene.id === "read-graph")!.content.body).toContain("Draw the graph on squared paper");
    expect(bars.offline.packageable).toBe(false);
  });

  it("every distractor keeps its own authored feedback", () => {
    const experience = toLessonExperience(lesson("equivalent-fractions.json", FRACTIONS));
    const check = experience.scenes.find((scene) => scene.id === "check")!;
    if (check.interaction.kind !== "MULTIPLE_CHOICE") throw new Error();
    const item = check.interaction.items[0];
    expect(item.optionFeedback).toHaveLength(item.options.length);
    expect(item.optionFeedback![2]).toContain("doubles only the top");
  });
});

describe("validation counts only evidence the runtime can collect", () => {
  const area = () => JSON.parse(readFileSync("curriculum/v2/g4-math/candidates/area-perimeter.json", "utf8"));
  const errors = (candidate: unknown) => validateCandidateAgainstContext(parseCandidateLessonV2(candidate), g4ProofContext(AREA)).errors;

  it("rejects evidence on an unsupported interaction whose fallback cannot collect it", () => {
    const candidate = area(); const scene = candidate.scenes.find((s: any) => s.id === "calculate");
    scene.fallback.kind = "TEXT_WALKTHROUGH"; scene.completion = "VIEWED";
    expect(errors(candidate)).toContain("evidence_not_collectable:calculate");
  });

  it("requires the completion rule of the rendered fallback", () => {
    const candidate = area(); candidate.scenes.find((s: any) => s.id === "calculate").completion = "VIEWED";
    expect(errors(candidate)).toContain("completion_mismatch:calculate");
  });

  it("treats an objective held back for inquiry as a reviewer call, not an error", () => {
    const candidate = JSON.parse(readFileSync("curriculum/v2/g4-math/candidates/equivalent-fractions.json", "utf8"));
    const goal = candidate.scenes.splice(1, 1)[0]; candidate.scenes.splice(4, 0, goal);
    const result = validateCandidateAgainstContext(parseCandidateLessonV2(candidate), g4ProofContext(FRACTIONS));
    expect(result.errors).not.toContain("objective_after_explanation");
    expect(result.gaps.map((gap) => gap.code)).toContain("OBJECTIVE_AFTER_EXPLANATION");
  });

  it("a paper fallback needs a stated non-visual path to count for screen-reader learners", () => {
    const solids = lesson("solid-figures.json", SOLIDS);
    const labScene = solids.scenes.find((scene) => scene.id === "lab")!;
    const runtime = { lab: { labId: "g4-solid-figures" } as any, studentEligible: false, keyboard: true, reducedMotion: true, offline: true, hasFallback2D: true };
    expect(sceneDeliverability(labScene, runtime, true).byScenario.SCREEN_READER).toBe("FALLBACK");
    const withoutPath = { ...labScene, accessibility: { ...labScene.accessibility, nonPointerAlternative: undefined } };
    expect(sceneDeliverability(withoutPath, runtime, true).byScenario.SCREEN_READER).toBe("NOT_DELIVERABLE");
  });
});

describe("native structure is never written without revision authority (writers off)", () => {
  afterEach(() => { delete process.env.P2A_PROVENANCE_WRITERS_DISABLED; });
  const native = { payload: { curriculumV2: { contractVersion: "curriculum-lesson-v2/1.0.0" } } };
  const context = { revisionKind: "EDIT", originKind: "HUMAN_AUTHORED" } as any;

  it("refuses create, update and upsert that carry native scene keys in compatibility mode", async () => {
    await expect(createCurriculumContent({ contentId: "c", title: "t", grade: 4, subject: "MATH", contentType: "lesson", ...native } as any, context)).rejects.toThrow("NATIVE_CURRICULUM_V2_REQUIRES_PROVENANCE_WRITERS");
    await expect(updateCurriculumContent({ contentId: "c" }, native as any, context)).rejects.toThrow("NATIVE_CURRICULUM_V2_REQUIRES_PROVENANCE_WRITERS");
    await expect(upsertCurriculumContent({ contentId: "c" }, { contentId: "c", title: "t", grade: 4, subject: "MATH", contentType: "lesson" } as any, native as any, context)).rejects.toThrow("NATIVE_CURRICULUM_V2_REQUIRES_PROVENANCE_WRITERS");
  });

  it("legacy adoption of a native payload starts as a DRAFT, never inheriting a published status", () => {
    expect(readFileSync("lib/curriculum/mutations/repository.ts", "utf8")).toContain('lifecycleState: isNativeCurriculumV2Payload(content.payload) ? "DRAFT" : lifecycleFromLegacyStatus(content.status)');
  });
});
