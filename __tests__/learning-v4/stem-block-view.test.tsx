// The student STEM dispatch: renders the five 1.2.0 blocks the player may show, refuses the gated code blocks.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GATED_CODE_BLOCKS, isStudentStemBlock, StemBlockView, STUDENT_STEM_BLOCKS, type StudentStemBlock } from "@/components/experience/blocks/stem/StemBlockView";
import { ActivityScope } from "@/components/experience/blocks/stem/ActivityScope";
import { TEACHING_BLOCK_REGISTRY_1_2, validateBlock_1_2, validateBlockReferences_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";

const blocks: StudentStemBlock[] = [
  { type: "DESIGN_CYCLE", id: "d", brief: "Design a cover.", criteria: [{ id: "leak", description: "Keeps water out", measure: "Water through", unit: "ml", comparison: "AT_MOST", target: 20 }],
    constraints: ["Paper and string only."], safety: ["Wipe up spills."], testPlan: ["Pour water.", "Measure it."], maxIterations: 2 },
  { type: "MEASUREMENT_TABLE", id: "t", title: "Water through", origin: "MEASURED_BY_LEARNER", originNote: "Class cup.", columns: [{ id: "secs", label: "Time", unit: "s", precision: 0, minimum: 0, maximum: 600 }, { id: "ml", label: "Water", unit: "ml", precision: 0, minimum: 0, maximum: 250 }],
    trials: [{ secs: null, ml: null }], derived: ["MEAN"] },
  { type: "GRAPH_BUILDER", id: "g", prompt: "Graph it.", sourceBlockId: "t", allowedKinds: ["BAR"], axisRules: { xColumn: "secs", yColumn: "ml", zeroBaselineRequired: true } },
  { type: "OBSERVATION_LOG", id: "o", prompt: "What did you see?", origin: "MEASURED_BY_LEARNER", fields: [{ id: "a", label: "Saw" }, { id: "b", label: "Think" }], maxEntries: 1, responseModes: ["TEXT"] },
  { type: "AUDIO_PROMPT", id: "a", text: "Listen.", lang: "en", fallback: "TEXT_AND_TEACHER_READ_ALOUD", autoplay: false },
];

describe("StemBlockView", () => {
  it("fixtures are valid 1.2.0 blocks with valid references", () => {
    for (const b of blocks) expect(validateBlock_1_2(b).problems).toEqual([]);
    expect(validateBlockReferences_1_2(blocks)).toEqual([]);
  });
  it("renders every student STEM block inside one activity", () => {
    const html = renderToStaticMarkup(<ActivityScope>{blocks.map((b) => <StemBlockView key={b.id} block={b} onDone={() => undefined} />)}</ActivityScope>);
    for (const t of STUDENT_STEM_BLOCKS) expect(html).toContain(`data-block-type="${t}"`);
  });
  it("covers exactly the interactive non-code STEM blocks of registry 1.2.0 that the player is asked to show", () => {
    for (const t of STUDENT_STEM_BLOCKS) expect(TEACHING_BLOCK_REGISTRY_1_2[t].interactive).toBe(true);
    for (const t of GATED_CODE_BLOCKS) expect(isStudentStemBlock({ type: t })).toBe(false);
  });
  it("refuses the gated code blocks", () => {
    for (const type of GATED_CODE_BLOCKS) expect(() => renderToStaticMarkup(<StemBlockView block={{ type } as unknown as StudentStemBlock} onDone={() => undefined} />)).toThrow(`stem_block_not_for_students:${type}`);
  });
});
