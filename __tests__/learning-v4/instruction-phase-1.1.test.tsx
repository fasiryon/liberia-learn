// @vitest-environment jsdom
// Instruction 1.1.0 phases in the student player (T2-P5-PHASE-TYPE-HANDOFF.md), on prep/v4-stem-player-integration.
//
// SYNTHETIC FIXTURE, TEST-ONLY: the experience is the sealed draft.6 fractions projection with one scene's phase changed
// to a Computing phase. It is NOT sealed instructional content, NOT a Grade 4 P5 lesson and NOT release evidence.
import fs from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/learner-experience/progressStore", () => ({ loadExperienceProgress: vi.fn(), saveExperienceProgress: vi.fn() }));
vi.mock("@/components/toolkit/toolComponents", () => ({ TOOL_COMPONENTS: {} }));
import { LessonPlayerV2 } from "@/components/learner-experience/LessonPlayerV2";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { INSTRUCTION_PHASES, PHASE_LABEL, V4_INSTRUCTION_STANDARD } from "@/lib/learner-experience/teaching/instruction";
import { INSTRUCTION_PHASES_1_1, PHASE_LABEL_1_1, V4_INSTRUCTION_STANDARD_1_1 } from "@/lib/learner-experience/teaching/instruction-1.1";
import { lessonPhaseLabel } from "@/lib/learner-experience/teaching/stemBlocks";
import type { LessonExperience } from "@/lib/learner-experience/types";

const SEALED = "curriculum/factory-v4/drafts/4.0.0-draft.6";
const projection = (key: string): LessonExperience => JSON.parse(fs.readFileSync(`${SEALED}/${key}/learner-projection.json`, "utf8"));
const DRAFT6 = fs.readdirSync(SEALED).filter((k) => fs.existsSync(`${SEALED}/${k}/learner-projection.json`));
const NEW_PHASES = INSTRUCTION_PHASES_1_1.filter((p) => !(INSTRUCTION_PHASES as readonly string[]).includes(p));

function withPhase(phase: string): LessonExperience {
  const base = projection("g7-math-fractions");
  const index = base.scenes.findIndex((s) => s.teaching);
  return { ...base, id: "synthetic:phase-1.1-fixture", scenes: base.scenes.map((s, i) => (i === index ? { ...s, teaching: { ...s.teaching!, phase: phase as never } } : s)) };
}

describe("phase labels", () => {
  it("every instruction 1.0.0 phase keeps its frozen label", () => {
    for (const phase of INSTRUCTION_PHASES) expect(lessonPhaseLabel(phase)).toBe(PHASE_LABEL[phase]);
  });
  it("every phase only 1.1.0 defines has its 1.1.0 label", () => {
    expect(NEW_PHASES.length).toBeGreaterThan(0);
    for (const phase of NEW_PHASES) expect(lessonPhaseLabel(phase)).toBe(PHASE_LABEL_1_1[phase]);
    for (const phase of NEW_PHASES) expect(lessonPhaseLabel(phase).trim()).not.toBe("");
  });
});

describe("scene contract by declared instruction standard", () => {
  it.each(DRAFT6)("draft.6 %s validates with no standard and with 1.0.0", (key) => {
    expect(() => validateLessonExperience(projection(key))).not.toThrow();
    expect(() => validateLessonExperience(projection(key), { instructionStandard: V4_INSTRUCTION_STANDARD })).not.toThrow();
  });
  it("a 1.1.0-only phase is refused unless the package declares 1.1.0", () => {
    expect(() => validateLessonExperience(withPhase("DEBUG"))).toThrow(/^scene_instruction_phase_requires_1_1:.*:DEBUG$/);
    expect(() => validateLessonExperience(withPhase("DEBUG"), { instructionStandard: V4_INSTRUCTION_STANDARD })).toThrow(/^scene_instruction_phase_requires_1_1:/);
    expect(() => validateLessonExperience(withPhase("DEBUG"), { instructionStandard: V4_INSTRUCTION_STANDARD_1_1 })).not.toThrow();
  });
  it("1.0.0 phases stay valid under 1.1.0", () => {
    expect(() => validateLessonExperience(projection("g7-math-fractions"), { instructionStandard: V4_INSTRUCTION_STANDARD_1_1 })).not.toThrow();
  });
  it("an unknown standard fails closed, and an undefined phase is refused under a declared standard", () => {
    expect(() => validateLessonExperience(projection("g7-math-fractions"), { instructionStandard: "liberialearn-v4-instruction/9.9.9" })).toThrow(/^instruction_standard_unknown:/);
    expect(() => validateLessonExperience(withPhase("TELEPORT"), { instructionStandard: V4_INSTRUCTION_STANDARD_1_1 })).toThrow(/^scene_instruction_phase_unknown:.*:TELEPORT$/);
  });
});

describe("canonical LessonPlayerV2 shows the 1.1.0 phase label", () => {
  let host: HTMLDivElement | null = null, root: Root | null = null;
  beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { act(() => root?.unmount()); host?.remove(); host = null; root = null; });
  it("a DEBUG scene reads 'Find and fix the bug'", async () => {
    const experience = withPhase("DEBUG");
    const index = experience.scenes.findIndex((s) => s.teaching?.phase === "DEBUG");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root!.render(<LessonPlayerV2 experience={experience} toolsByScene={{}} exitHref="/student/lessons" returnSceneId={experience.scenes[index]!.id} progressStorage="MEMORY" />));
    expect(host.textContent).toContain(PHASE_LABEL_1_1.DEBUG);
  });
});
