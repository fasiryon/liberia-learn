import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "fs";
import { generateDraft5, DRAFT5_PROFILE } from "@/lib/content-factory/v4/draft5/generate";
import { buildReferenceCandidate } from "@/lib/content-factory/v4/referenceBatch";
import { V4_LESSONS } from "@/lib/curriculum/v4/candidates";
import { authorLesson } from "@/lib/content-factory/v4/draft5/lessonAuthor";
import { diagnoseNumeric } from "@/lib/learner-experience/teaching/models/numericResponse";
import { LIBERIA_COUNTIES } from "@/lib/learner-experience/teaching/models/liberiaCounties";
import { assertV4AnswerIsolation, buildVisualSidecar, normalizedFile } from "@/lib/content-factory/v4/generation";
import { specFor } from "@/__tests__/assessment-v2/fixtures";
import { factoryLearnerProjection } from "@/lib/curriculum/v4/factoryProjection";

const lesson = DRAFT5_PROFILE.lessons[0], geometry = authorLesson(lesson);
const blocks = geometry.scenes.flatMap(s => s.teaching?.blocks ?? []);
describe("versioned draft.5 content and immutable regeneration", () => {
 it("rebuilds both new packages byte for byte and retains mtimes on a disk rerun", async () => {
  const before = new Map<string, number>();
  for (const current of DRAFT5_PROFILE.lessons) {
   const first = await buildReferenceCandidate(current, DRAFT5_PROFILE), second = await buildReferenceCandidate(current, DRAFT5_PROFILE);
   expect(first).toEqual(second);
   for (const [name, bytes] of Object.entries(first.files)) {
    const file = `curriculum/factory-v4/drafts/4.0.0-draft.5/${current.key}/${name}`;
    expect(readFileSync(file, "utf8")).toBe(bytes);
    before.set(file, statSync(file).mtimeMs);
   }
  }
  await generateDraft5();
  for (const [file, mtime] of before) expect(statSync(file).mtimeMs).toBe(mtime);
 });
 it.each(V4_LESSONS)("retains every legacy draft.4 generated file for $key", async current => {
  const regenerated = await buildReferenceCandidate(current);
  for (const [name, bytes] of Object.entries(regenerated.files)) expect(normalizedFile(`curriculum/factory-v4/drafts/4.0.0-draft.4/${current.key}/${name}`)).toBe(bytes);
 });
 it("has a different valid guided triangle and an answer field for the units explanation", () => {
  const worked = blocks.find(b => b.type === "WORKED_SOLUTION" && b.id === "triangle-worked");
  const guided = blocks.find(b => b.type === "NUMERIC_RESPONSE" && b.id === "guided-triangle");
  expect(worked?.type === "WORKED_SOLUTION" && worked.shape).not.toEqual(guided?.type === "NUMERIC_RESPONSE" && guided.shape);
  if (guided?.type !== "NUMERIC_RESPONSE") throw Error("guided_triangle_missing");
  expect(guided.parts.map(p => p.formativeKey.value)).toEqual([12, 18]);
  const scene = geometry.scenes.find(s => s.teaching?.phase === "SOLVE_WITH_SUPPORT")!;
  expect(scene.interaction.kind).toBe("FREE_RESPONSE");
  expect(scene.teaching?.blocks.some(b => b.type === "CHECK" && b.id === "units-reason")).toBe(true);
  expect(geometry.scenes.every(s => !s.learnerAction.includes("Use the model, complete its task"))).toBe(true);
 });
 it("checks correct units and diagnoses actual mistaken numeric responses locally", () => {
  const guided = blocks.find(b => b.type === "NUMERIC_RESPONSE" && b.id === "guided-triangle");
  if (guided?.type !== "NUMERIC_RESPONSE") throw Error("guided_triangle_missing");
  const area = guided.parts[0], perimeter = guided.parts[1];
  expect(diagnoseNumeric(area, "12", "m2", guided.shape).result).toBe("right");
  expect(diagnoseNumeric(perimeter, "18", "m", guided.shape).result).toBe("right");
  expect(diagnoseNumeric(area, "24", "m2", guided.shape).code).toBe("FORGOT_HALF");
  const slope = diagnoseNumeric(area, "20", "m2", guided.shape);
  expect(slope.code).toBe("AUTHORED");
  expect(slope.text).toContain("sloping side 5"); expect(slope.text).toContain("perpendicular height 3");
  expect(slope.misconceptionId).toBe("guided-triangle-area");
  expect(diagnoseNumeric(perimeter, "16", "m", guided.shape).text).toContain("inside height 3");
  expect(diagnoseNumeric(area, "12", "m", guided.shape).code).toBe("UNIT_WRONG");
 });
 it("states honest register objectives and preserves all fifteen county-capital pairs", () => {
  const lesson = DRAFT5_PROFILE.lessons.find(l => l.subject === "CIVICS")!, candidate = authorLesson(lesson);
  expect(lesson.objectives.some(o => /locate|outline map|counties crossed/i.test(o.statement))).toBe(false);
  expect(candidate.scenes.flatMap(s => s.teaching?.blocks ?? []).some(b => b.type === "MAP_EXPLORER")).toBe(false);
  const register = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []).find(b => b.type === "READING_PASSAGE");
  if (register?.type !== "READING_PASSAGE") throw Error("register_missing");
  for (const county of LIBERIA_COUNTIES) expect(register.paragraphs.join(" ")).toContain(`${county.name}: ${county.capital}.`);
 });
 it("stamps draft.5 and keeps protected assessments out of learner and offline content", () => {
  const sidecar = buildVisualSidecar(lesson, geometry, DRAFT5_PROFILE.inputs);
  const spec = specFor("protected", { kind: "SHORT_CONSTRUCTED", acceptedAnswers: ["r7-protected-answer-sentinel"], autoScore: "EXACT_NORMALIZED" });
  expect(() => assertV4AnswerIsolation(geometry, sidecar, { items: [], specs: [spec] })).not.toThrow();
  const projection = factoryLearnerProjection(lesson, geometry, "4.0.0-draft.5");
  expect(projection.version).toBe("4.0.0-draft.5");
  expect(projection.scenes.every(s => s.offline.mode === "FULL")).toBe(true);
  for (const scene of projection.scenes.filter(s => s.type === "MASTERY_CHECK")) {
   expect(scene.teaching).toBeUndefined();
   expect(scene.interaction.kind === "ASSESSMENT_HANDOFF" && scene.interaction.assessment.items).toEqual([]);
  }
  expect(sidecar.blocks.every(b => b.offline.mode === "TEXT_PAPER_CAPTURE_ONLY" && b.offline.responsePrompt.length > 0)).toBe(true);
 });
});
