// teaching-blocks/1.2.0 and instruction 1.1.0: additive identifiers, frozen 1.1.0 / 1.0.0, grade applicability
// (Kindergarten = 0), the grade-3 and K-2 mistake forms, and code limits derived from the interpreter.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { BLOCK_SCHEMAS, TEACHING_BLOCK_REGISTRY, TEACHING_BLOCK_REGISTRY_VERSION } from "@/lib/learner-experience/teaching/registry";
import { INDEPENDENT_PHASES, INSTRUCTION_PATTERNS, V4_INSTRUCTION_STANDARD } from "@/lib/learner-experience/teaching/instruction";
import { INDEPENDENT_PHASES_1_1, INSTRUCTION_PATTERNS_1_1, PHASE_LABEL_1_1, V4_INSTRUCTION_STANDARD_1_1, patternsFor, subjectFamily_1_1 } from "@/lib/learner-experience/teaching/instruction-1.1";
import { BLOCK_SCHEMAS_1_2, CODE_LIMITS_SCHEMA, TEACHING_BLOCK_REGISTRY_1_2, TEACHING_BLOCK_REGISTRY_VERSION_1_2, blocksFor_1_2, mistakeRequirement, registryFor, validateBlock_1_2, validateBlockReferences_1_2, type VisualBlock_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";
import { LLCODE_LIMITS } from "@/lib/learner-experience/stem/llcode";

const cos = createRequire(import.meta.url)("../../curriculum/program/stem-v1/source/standards.cjs");
const mistake = (over: Record<string, unknown> = {}) => ({ type: "MISTAKE_ANALYSIS", id: "m1", problem: "Ada adds 3 and 4.", attempt: { name: "Ada", steps: ["3 + 4 = 8"] },
  question: "What went wrong?", options: [{ id: "a", text: "She counted one too many.", feedback: "Yes. She counted 3 again.", misconceptionId: "count-start-again" },
    { id: "b", text: "Nothing.", feedback: "Check by counting on from 3.", misconceptionId: "trust-first-answer" }, { id: "c", text: "She added wrongly at the end.", feedback: "The last step was fine.", misconceptionId: "blame-last-step" }],
  formativeKey: { expectedOptionId: "a" }, correction: ["Count on from 3: 4, 5, 6, 7.", "3 + 4 = 7."], ...over });

describe("frozen versions are untouched", () => {
  it("1.1.0 and instruction 1.0.0 keep their literals, patterns and ranges", () => {
    expect(TEACHING_BLOCK_REGISTRY_VERSION).toBe("teaching-blocks/1.1.0");
    expect(V4_INSTRUCTION_STANDARD).toBe("liberialearn-v4-instruction/1.0.0");
    expect(Object.keys(INSTRUCTION_PATTERNS)).toEqual(["MATHEMATICS", "SCIENCE", "HUMANITIES", "LANGUAGE"]);
    expect(TEACHING_BLOCK_REGISTRY.MISTAKE_ANALYSIS.grades).toEqual([4, 12]);
    expect(TEACHING_BLOCK_REGISTRY.CHECK.grades).toEqual([1, 12]);
    expect("CODE_TRACE" in BLOCK_SCHEMAS).toBe(false);
    expect(BLOCK_SCHEMAS.CHECK.safeParse({ type: "CHECK", id: "c", items: [{ id: "i", prompt: "p", options: [{ id: "a", text: "a", feedback: "f", misconceptionId: "x" }, { id: "b", text: "b", feedback: "f" }], formativeKey: { expectedOptionId: "a" } }] }).success).toBe(false);
    expect(INDEPENDENT_PHASES.has("TEST" as never)).toBe(false);
  });
  it("registryFor dispatches by sealed version and refuses unknown versions", () => {
    expect(registryFor("teaching-blocks/1.1.0").entries.MISTAKE_ANALYSIS.grades).toEqual([4, 12]);
    expect(registryFor("teaching-blocks/1.2.0").entries.MISTAKE_ANALYSIS.grades).toEqual([3, 12]);
    expect(() => registryFor("teaching-blocks/1.3.0")).toThrow("teaching_block_registry_unknown");
    expect(TEACHING_BLOCK_REGISTRY_VERSION_1_2).toBe("teaching-blocks/1.2.0");
  });
});

describe("instruction 1.1.0", () => {
  it("adds Computing and Engineering exactly as the CoS standard, with the independent phases", () => {
    expect(V4_INSTRUCTION_STANDARD_1_1).toBe("liberialearn-v4-instruction/1.1.0");
    expect(INSTRUCTION_PATTERNS_1_1.COMPUTING).toEqual(cos.PATTERNS.COMPUTING);
    expect(INSTRUCTION_PATTERNS_1_1.ENGINEERING).toEqual(cos.PATTERNS.ENGINEERING);
    for (const family of ["MATHEMATICS", "SCIENCE", "HUMANITIES", "LANGUAGE"] as const) expect(INSTRUCTION_PATTERNS_1_1[family]).toEqual(cos.PATTERNS[family]);
    for (const p of ["BUILD_INDEPENDENTLY", "TEST", "REFINE", "PRACTICE_INDEPENDENTLY", "APPLY"] as const) expect(INDEPENDENT_PHASES_1_1.has(p)).toBe(true);
    for (const p of ["BUILD_WITH_SUPPORT", "DEMONSTRATE", "DEBUG"] as const) expect(INDEPENDENT_PHASES_1_1.has(p)).toBe(false);
    for (const p of [...INSTRUCTION_PATTERNS_1_1.COMPUTING, ...INSTRUCTION_PATTERNS_1_1.ENGINEERING]) expect(PHASE_LABEL_1_1[p]).toBeTruthy();
    expect(subjectFamily_1_1("COMPUTER_SCIENCE")).toBe("COMPUTING");
    expect(subjectFamily_1_1("ENGINEERING_FOUNDATIONS")).toBe("ENGINEERING");
    expect(subjectFamily_1_1("MATH")).toBe("MATHEMATICS");
    expect("COMPUTING" in patternsFor("liberialearn-v4-instruction/1.0.0")).toBe(false);
  });
});

describe("teaching-blocks/1.2.0 grade applicability", () => {
  it("Kindergarten (grade 0) can use every block K-2 needs; Grade 3 gets MISTAKE_ANALYSIS; code starts at 6", () => {
    const k = blocksFor_1_2({ subject: "MATH", grade: 0 });
    for (const t of ["CHECK", "SORT", "SEQUENCE", "ARRAY_MODEL", "SHAPE_MODEL", "AUDIO_PROMPT", "TEN_FRAME_COUNTERS", "GRID_ROBOT_PROGRAM"]) expect(k).toContain(t);
    expect(k).not.toContain("MISTAKE_ANALYSIS");
    expect(blocksFor_1_2({ subject: "MATH", grade: 3 })).toContain("MISTAKE_ANALYSIS");
    expect(blocksFor_1_2({ subject: "COMPUTER_SCIENCE", grade: 5 })).not.toContain("CODE_RUNNER");
    expect(blocksFor_1_2({ subject: "COMPUTER_SCIENCE", grade: 7 })).toEqual(expect.arrayContaining(["CODE_TRACE", "CODE_RUNNER"]));
    expect(blocksFor_1_2({ subject: "ENGLISH", grade: 1 })).toContain("PHONICS_BLENDER");
    expect(blocksFor_1_2({ subject: "ENGINEERING_FOUNDATIONS", grade: 2 })).toContain("DESIGN_CYCLE");
  });
});

describe("mistake diagnosis forms (COS-EARLY-PRIMARY-RULING)", () => {
  it("grade 3 MISTAKE_ANALYSIS passes within the limits and names its misconceptions", () => {
    expect(validateBlock_1_2(mistake(), { subject: "MATH", grade: 3 }).problems).toEqual([]);
    expect(validateBlock_1_2(mistake(), { subject: "MATH", grade: 2 }).problems).toContain("block_grade_unfit:MISTAKE_ANALYSIS:2");
  });
  it("grade 3 rejects long attempts, too many options, long corrections, unlinked wrong options and long sentences", () => {
    const p = (over: Record<string, unknown>) => validateBlock_1_2(mistake(over), { subject: "MATH", grade: 3 }).problems;
    expect(p({ attempt: { name: "Ada", steps: ["a", "b", "c", "d"] } })).toContain("mistake_g3_attempt_steps");
    expect(p({ options: [...(mistake().options as object[]), { id: "d", text: "d", feedback: "f", misconceptionId: "x" }] })).toContain("mistake_g3_options");
    expect(p({ correction: ["a", "b", "c", "d"] })).toContain("mistake_g3_correction_lines");
    expect(p({ options: [{ id: "a", text: "Right.", feedback: "Yes." }, { id: "b", text: "Wrong.", feedback: "No." }] })).toContain("mistake_g3_unlinked_wrong_option");
    expect(p({ question: "Which of these many words in this one very long sentence shows exactly where the counting went wrong today?" })).toContain("mistake_g3_sentence_length");
    // Grade 4+ keeps the 1.1.0 shape without the grade-3 limits.
    expect(validateBlock_1_2(mistake({ correction: ["a", "b", "c", "d"] }), { subject: "MATH", grade: 4 }).problems).toEqual([]);
  });
  it("K-2 oral spot-the-mistake: AUDIO_PROMPT plus a CHECK whose wrong options name misconceptions", () => {
    const audio = { type: "AUDIO_PROMPT", id: "a1", text: "Look at Musu's counting. Is it right?", lang: "en-LR", fallback: "TEXT_AND_TEACHER_READ_ALOUD", autoplay: false };
    const check = (linkWrong: boolean) => ({ type: "CHECK", id: "c1", items: [{ id: "i1", prompt: "What did Musu do?", formativeKey: { expectedOptionId: "a" },
      options: [{ id: "a", text: "Counted one bottle cap twice", feedback: "Yes, touch each cap once." }, { id: "b", text: "Counted right", feedback: "Count again with her.", ...(linkWrong ? { misconceptionId: "double-count" } : {}) }] }] });
    const parse = (b: object) => validateBlock_1_2(b, { subject: "MATH", grade: 0 }).block as VisualBlock_1_2;
    expect(validateBlock_1_2(audio, { subject: "MATH", grade: 0 }).problems).toEqual([]);
    expect(mistakeRequirement([parse(audio), parse(check(true))], 0)).toEqual({ met: true, form: "ORAL_SPOT_THE_MISTAKE", misconceptions: ["double-count"] });
    expect(mistakeRequirement([parse(audio), parse(check(false))], 1).met).toBe(false);
    expect(mistakeRequirement([parse(check(true))], 2).met).toBe(false);
    expect(mistakeRequirement([validateBlock_1_2(mistake(), { subject: "MATH", grade: 3 }).block!], 3)).toMatchObject({ met: true, form: "MISTAKE_ANALYSIS" });
  });
});

describe("STEM block schemas", () => {
  it("code limits are exactly the interpreter's published limits", () => {
    const max = Object.fromEntries(Object.entries(LLCODE_LIMITS).filter(([k]) => k !== "maxInteger"));
    expect(CODE_LIMITS_SCHEMA.safeParse(max).success).toBe(true);
    for (const key of Object.keys(max)) expect(CODE_LIMITS_SCHEMA.safeParse({ ...max, [key]: (max as Record<string, number>)[key] + 1 }).success, key).toBe(false);
  });
  it("code blocks accept only the llcode/1.0.0 language identifier", () => {
    const trace = { type: "CODE_TRACE", id: "t", prompt: "Trace it.", language: "llcode/1.0.0", program: "print(1)", inputs: {}, watch: ["x"], maxTraceSteps: 10 };
    expect(BLOCK_SCHEMAS_1_2.CODE_TRACE.safeParse(trace).success).toBe(true);
    expect(BLOCK_SCHEMAS_1_2.CODE_TRACE.safeParse({ ...trace, language: "PYTHON_SUBSET_V1" }).success).toBe(false);
    expect(BLOCK_SCHEMAS_1_2.CODE_TRACE.safeParse({ ...trace, inputs: { constructor: 1 } }).success).toBe(false);
  });
  it("learner measurements cannot be pre-filled, unreachable grids are rejected, graphs must reference a table", () => {
    const table = { type: "MEASUREMENT_TABLE", id: "tbl", title: "Water lost", origin: "MEASURED_BY_LEARNER", originNote: "Learners measure in class.",
      columns: [{ id: "day", label: "Day", unit: "", precision: 0, minimum: 0, maximum: 10 }, { id: "ml", label: "Water lost", unit: "mL", precision: 0, minimum: 0, maximum: 500 }], trials: [{ day: null, ml: null }], derived: ["MEAN"] };
    expect(validateBlock_1_2(table, { subject: "SCIENCE", grade: 5 }).problems).toEqual([]);
    expect(validateBlock_1_2({ ...table, trials: [{ day: 1, ml: 40 }] }).problems[0]).toContain("prefilled_learner_measurement_forbidden");
    const grid = { type: "GRID_ROBOT_PROGRAM", id: "g", prompt: "Reach the flag.", grid: { rows: 3, columns: 3 }, start: { row: 0, column: 0 }, goal: { row: 2, column: 2 }, obstacles: [{ row: 1, column: 2 }, { row: 2, column: 1 }], allowedMoves: ["SOUTH", "EAST"], maxSteps: 10 };
    expect(validateBlock_1_2(grid).problems[0]).toContain("grid_unsolvable");
    const graph = { type: "GRAPH_BUILDER", id: "gr", prompt: "Plot it.", sourceBlockId: "tbl", allowedKinds: ["BAR"], axisRules: { xColumn: "day", yColumn: "ml", zeroBaselineRequired: true } };
    const t = validateBlock_1_2(table).block!, g = validateBlock_1_2(graph).block!;
    expect(validateBlockReferences_1_2([t, g])).toEqual([]);
    expect(validateBlockReferences_1_2([g])).toEqual(["graph_reference_invalid:gr"]);
  });
  it("every 1.2.0 block type has a registry entry", () => {
    expect(Object.keys(TEACHING_BLOCK_REGISTRY_1_2).sort()).toEqual(Object.keys(BLOCK_SCHEMAS_1_2).sort());
  });
});
