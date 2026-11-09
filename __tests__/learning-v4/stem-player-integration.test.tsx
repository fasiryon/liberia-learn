// @vitest-environment jsdom
// Student-player integration of teaching-blocks/1.2.0+ STEM blocks (CoS hooks #4-#7), on prep/v4-stem-player-integration.
//
// SYNTHETIC FIXTURE, TEST-ONLY: the experience below is derived from the sealed draft.6 fractions projection with one
// scene's blocks replaced by synthetic STEM blocks and the subject set to ENGINEERING / grade 4 so the blocks fit. It is
// NOT sealed instructional content, NOT a Grade 4 P6 lesson and NOT release evidence; it only exercises the adapter.
import fs from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
const history = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/learner-experience/progressStore", () => ({ loadExperienceProgress: history.load, saveExperienceProgress: history.save }));
vi.mock("@/components/toolkit/toolComponents", () => ({ TOOL_COMPONENTS: {} }));
import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { lessonBlockRequiresCompletion } from "@/lib/learner-experience/teaching/stemBlocks";
import { blockRequiresCompletion } from "@/lib/learner-experience/teaching/registry";
import type { LessonExperience } from "@/lib/learner-experience/types";

const SEALED = "curriculum/factory-v4/drafts/4.0.0-draft.6";
const projection = (key: string): LessonExperience => JSON.parse(fs.readFileSync(`${SEALED}/${key}/learner-projection.json`, "utf8"));
const DRAFT6 = fs.readdirSync(SEALED).filter((k) => fs.existsSync(`${SEALED}/${k}/learner-projection.json`));

const STEM_BLOCKS = [
  { type: "DESIGN_CYCLE", id: "synthetic-cover", brief: "Synthetic fixture: design a cover that keeps rain out of a bucket.",
    criteria: [{ id: "leak", description: "Keeps water out", measure: "Water that got through", unit: "ml", comparison: "AT_MOST", target: 20 }],
    constraints: ["Paper, plastic and string only."], safety: ["Wipe up spills at once."], testPlan: ["Pour one cup of water.", "Measure what got through."], maxIterations: 2,
    measurement: { tableId: "synthetic-results", criterionColumns: [{ criterionId: "leak", columnId: "leak" }] } },
  { type: "MEASUREMENT_TABLE", id: "synthetic-results", title: "Synthetic fixture: cover designs", origin: "MEASURED_BY_LEARNER", originNote: "One row per design.",
    columns: [{ id: "layers", label: "Layers", unit: "", precision: 0, minimum: 1, maximum: 5 }, { id: "leak", label: "Water through", unit: "ml", precision: 0, minimum: 0, maximum: 250 }],
    trials: [{ layers: null, leak: null }, { layers: null, leak: null }], derived: [] },
] as const;
// AUDIO_PROMPT is K-2 only, so it cannot share a grade-4 scene with MEASUREMENT_TABLE (3-12); the contract refuses that.
const AUDIO = { type: "AUDIO_PROMPT", id: "synthetic-listen", text: "Synthetic fixture: listen.", lang: "en-LR", fallback: "TEXT_AND_TEACHER_READ_ALOUD", autoplay: false } as const;

function synthetic(blocks: readonly unknown[] = STEM_BLOCKS): LessonExperience {
  const base = projection("g7-math-fractions");
  const viewed = base.scenes.find((s) => s.type === "GUIDED_EXAMPLE")!, mastery = base.scenes.find((s) => s.type === "MASTERY_CHECK")!;
  return { ...base, id: "synthetic:stem-player-fixture", subject: "ENGINEERING", grade: 4,
    scenes: [{ ...viewed, teaching: { phase: viewed.teaching!.phase, blocks: blocks as never } }, mastery] };
}
const V13 = { registryVersion: "teaching-blocks/1.3.0" };

describe("scene contract by sealed registry version (hook #4)", () => {
  it.each(DRAFT6)("draft.6 %s validates the same with no version and with its sealed 1.1.0", (key) => {
    const e = projection(key);
    expect(() => validateLessonExperience(e)).not.toThrow();
    expect(() => validateLessonExperience(e, { registryVersion: "teaching-blocks/1.1.0" })).not.toThrow();
  });
  it("admits the synthetic STEM scene only under the registry that defines its blocks", () => {
    expect(() => validateLessonExperience(synthetic(), V13)).not.toThrow();
    expect(() => validateLessonExperience(synthetic(), { registryVersion: "teaching-blocks/1.2.0" })).toThrow(/^teaching_blocks_invalid:block_schema:DESIGN_CYCLE/);
    expect(() => validateLessonExperience(synthetic())).toThrow(/block_type_unsupported:DESIGN_CYCLE/);
    expect(() => validateLessonExperience(synthetic([AUDIO, ...STEM_BLOCKS]), V13)).toThrow("teaching_blocks_invalid:block_grade_unfit:AUDIO_PROMPT:4");
    expect(() => validateLessonExperience(synthetic(), { registryVersion: "teaching-blocks/1.1.0" })).toThrow(/block_type_unsupported/);
  });
  it("fails closed on an unknown version", () => {
    expect(() => validateLessonExperience(projection("g7-math-fractions"), { registryVersion: "teaching-blocks/2.0.0" })).toThrow("teaching_block_registry_unknown:teaching-blocks/2.0.0");
  });
  it("refuses code blocks even where the registry defines them", () => {
    const robot = { type: "GRID_ROBOT_PROGRAM", id: "synthetic-robot", prompt: "p", grid: { rows: 2, columns: 2 }, start: { row: 0, column: 0 }, goal: { row: 1, column: 1 }, obstacles: [], allowedMoves: ["SOUTH", "EAST"], maxSteps: 4 };
    expect(() => validateLessonExperience(synthetic([...STEM_BLOCKS, robot]), V13)).toThrow(/^scene_code_block_gated:/);
  });
  it("keeps activity links inside one scene, since each scene is one ActivityScope", () => {
    const e = synthetic(STEM_BLOCKS.filter((b) => b.type !== "MEASUREMENT_TABLE"));
    const moved = { ...e, scenes: [e.scenes[0], { ...e.scenes[0], id: "synthetic-other", teaching: { phase: e.scenes[0].teaching!.phase, blocks: [STEM_BLOCKS[1]] as never } }, e.scenes[1]] };
    expect(() => validateLessonExperience(moved, V13)).toThrow("scene_activity_reference_cross_scene:");
  });
  it("never accepts a STEM block as the scene's primary visual", () => {
    const e = synthetic();
    const visual = { ...e, scenes: [{ ...e.scenes[0], teaching: { ...e.scenes[0].teaching!, visual: STEM_BLOCKS[1] as never } }, e.scenes[1]] };
    expect(() => validateLessonExperience(visual, V13)).toThrow(/^scene_stem_block_in_visual:/);
  });
});

describe("completion rule (hook #6)", () => {
  it("1.1.0 blocks keep their frozen rule; STEM blocks gate except AUDIO_PROMPT", () => {
    for (const key of DRAFT6) for (const s of projection(key).scenes) for (const b of s.teaching?.blocks ?? []) expect(lessonBlockRequiresCompletion(b)).toBe(blockRequiresCompletion(b as never));
    expect([AUDIO, ...STEM_BLOCKS].map((b) => lessonBlockRequiresCompletion(b as never))).toEqual([false, true, true]);
  });
});

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => root?.unmount()); root = null; host?.remove(); vi.restoreAllMocks(); });
const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
const button = (el: Element, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;

describe("canonical LessonPlayerV2 with the synthetic STEM scene (hook #7)", () => {
  it("renders through StemBlockView, gates Continue on the activity, and writes nothing anywhere", async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root!.render(<LessonPlayerV2 experience={synthetic()} toolsByScene={{}} exitHref="/student/lessons" returnSceneId={null} progressStorage="MEMORY" />));
    for (const t of ["DESIGN_CYCLE", "MEASUREMENT_TABLE"]) expect(host.querySelector(`[data-block-type="${t}"]`)).not.toBeNull();
    expect(host.textContent).toContain("Finish the activities in this scene to continue.");
    // One continuous activity: design 1 is tested in the cycle and appears as row 1 of the table.
    const cycle = host.querySelector('[data-block-type="DESIGN_CYCLE"]')!;
    setValue(cycle.querySelector("textarea")!, "Two layers of plastic tied with string.");
    await click(button(cycle, "Next: stay safe"));
    await click(cycle.querySelector('[data-stage-body="SAFETY"] input[type=checkbox]')!);
    await click(button(cycle, "Next: test"));
    setValue(cycle.querySelector('[data-stage-body="TEST"] input') as HTMLInputElement, "12");
    await click(button(cycle, "Next: check the results"));
    const table = host.querySelector('[data-block-type="MEASUREMENT_TABLE"]')!;
    expect([...table.querySelectorAll("td[data-fed]")].map((td) => td.textContent)).toEqual(["12", "Design 2 not tested yet"]);
    expect(host.textContent).toContain("Finish the activities in this scene to continue.");
    const layers = [...table.querySelectorAll("input")] as HTMLInputElement[];
    setValue(layers[0], "2"); setValue(layers[1], "1");
    expect(host.textContent).not.toContain("Finish the activities in this scene to continue.");
    await click(button(host, "Continue"));
    expect(host.querySelector('[data-block-type="DESIGN_CYCLE"]')).toBeNull();
    expect(history.load).not.toHaveBeenCalled(); expect(history.save).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  const tableInputs = () => [...host.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] input')] as HTMLInputElement[];
  async function finishActivity() {
    const cycle = host.querySelector('[data-block-type="DESIGN_CYCLE"]')!;
    setValue(cycle.querySelector("textarea")!, "Two layers of plastic.");
    await click(button(cycle, "Next: stay safe"));
    await click(cycle.querySelector('[data-stage-body="SAFETY"] input[type=checkbox]')!);
    await click(button(cycle, "Next: test"));
    setValue(cycle.querySelector('[data-stage-body="TEST"] input') as HTMLInputElement, "12");
    await click(button(cycle, "Next: check the results"));
    setValue(tableInputs()[0], "2"); setValue(tableInputs()[1], "1");
  }
  it("leaving and re-entering a scene discards its learner values (T2 ack condition)", async () => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    // Synthetic: a STEM-free scene after the activity so the learner can move away and come back.
    const e = synthetic(), other = projection("g7-math-fractions").scenes.find((s) => s.type === "GUIDED_EXAMPLE")!;
    const experience = { ...e, scenes: [e.scenes[0], { ...other, id: "synthetic-after", teaching: undefined }, e.scenes[1]] };
    await act(async () => root!.render(<LessonPlayerV2 experience={experience} toolsByScene={{}} exitHref="/student/lessons" returnSceneId={null} progressStorage="MEMORY" />));
    await finishActivity();
    expect(tableInputs()[0].value).toBe("2");
    await click(button(host, "Continue"));
    expect(host.querySelector('[data-block-type="MEASUREMENT_TABLE"]')).toBeNull();
    await click(button(host, "Previous"));
    expect(tableInputs().map((i) => i.value)).toEqual(["", ""]);
    expect(host.querySelector('[data-block-type="MEASUREMENT_TABLE"] td[data-fed]')?.textContent).toBe("Design 1 not tested yet");
  });
  it("switching to another lesson with the same scene ids starts a fresh activity (T2 ack condition)", async () => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    const first = synthetic(), second = { ...synthetic(), id: "synthetic:stem-player-fixture-2" };
    expect(second.scenes.map((s) => s.id)).toEqual(first.scenes.map((s) => s.id));
    await act(async () => root!.render(<LessonPlayerV2 experience={first} toolsByScene={{}} exitHref="/student/lessons" returnSceneId={null} progressStorage="MEMORY" />));
    setValue(tableInputs()[0], "4");
    await act(async () => root!.render(<LessonPlayerV2 experience={second} toolsByScene={{}} exitHref="/student/lessons" returnSceneId={null} progressStorage="MEMORY" />));
    expect(tableInputs()[0].value).toBe("");
  });
});
