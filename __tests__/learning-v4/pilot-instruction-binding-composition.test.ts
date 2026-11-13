/**
 * T1 composition check for T2's verified-version binding (ba58e2b5, composed as a62162e6) on the school-day + player
 * integration. T2's own test reads the private P5 Computing .1 package, which is not on this line; this test proves the
 * same contract with the real T1 scene contract and a real sealed draft.6 lesson:
 * - loadDraft6Review returns the exact declarations from the hash-verified sidecar, and they validate;
 * - a 1.1-only phase passes only with a declared instruction 1.1.0 standard; absent or 1.0.0 is refused;
 * - unknown instruction or registry declarations fail closed; code blocks stay refused.
 * The DEBUG phase below is a TEST-ONLY synthetic edit of an in-memory copy, never release evidence.
 */
import { describe, expect, it } from "vitest";
import { loadDraft6Review } from "@/lib/curriculum/v4/draft6Review";
import { pilotExperience } from "@/lib/curriculum/v4/learningPreview";
import type { LessonExperience } from "@/lib/learner-experience/types";

const loaded = loadDraft6Review("factory@4.0.0-draft.6@g7-math-area-perimeter");
const v11 = { registryVersion: loaded.teachingVersions.registryVersion, instructionStandard: "liberialearn-v4-instruction/1.1.0" };
// TEST-ONLY: one teaching scene (kept by the pilot view) carries the instruction 1.1.0 phase DEBUG.
const withDebugPhase = (): LessonExperience => {
  const target = loaded.experience.scenes.find((s) => s.teaching && s.type !== "MASTERY_CHECK" && s.type !== "PRACTICE")!;
  return { ...loaded.experience, scenes: loaded.experience.scenes.map((s) => s.id === target.id ? { ...s, teaching: { ...s.teaching!, phase: "DEBUG" } } : s) } as LessonExperience;
};

describe("verified teaching versions reach scene validation (composition)", () => {
  it("returns the sealed draft.6 declarations and validates the lesson with them", () => {
    expect(loaded.teachingVersions).toEqual({ registryVersion: "teaching-blocks/1.1.0", instructionStandard: "liberialearn-v4-instruction/1.0.0" });
    expect(() => pilotExperience(loaded.experience, loaded.teachingVersions)).not.toThrow();
  });
  it("a 1.1-only phase passes with a declared instruction 1.1.0 standard", () => {
    const view = pilotExperience(withDebugPhase(), v11);
    expect(view.scenes.some((s) => s.teaching?.phase === "DEBUG")).toBe(true);
  });
  it("refuses a 1.1-only phase when the declaration is absent or 1.0.0", () => {
    expect(() => pilotExperience(withDebugPhase())).toThrow("scene_instruction_phase_requires_1_1");
    expect(() => pilotExperience(withDebugPhase(), loaded.teachingVersions)).toThrow("scene_instruction_phase_requires_1_1");
  });
  it("refuses unknown instruction or registry declarations", () => {
    expect(() => pilotExperience(withDebugPhase(), { ...v11, instructionStandard: "unknown" })).toThrow("instruction_standard_unknown");
    expect(() => pilotExperience(withDebugPhase(), { ...v11, registryVersion: "unknown" })).toThrow("teaching_block_registry_unknown");
  });
  it("still refuses a code block under declared versions", () => {
    const source = withDebugPhase(), scene = source.scenes.find((s) => s.teaching?.phase === "DEBUG")!;
    const gated = { ...source, scenes: source.scenes.map((s) => s.id === scene.id ? { ...s, teaching: { ...s.teaching!, blocks: [...s.teaching!.blocks, { type: "CODE_RUNNER", id: "gated-code" }] } } : s) } as LessonExperience;
    expect(() => pilotExperience(gated, { ...v11, registryVersion: "teaching-blocks/1.2.0" })).toThrow("scene_code_block_gated");
  });
});
