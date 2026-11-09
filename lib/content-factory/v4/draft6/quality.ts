import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import type { V4Lesson } from "@/lib/curriculum/v4/candidates";
import type { VisualBlock } from "@/lib/learner-experience/teaching/registry";
import { HEATING_POINTS } from "./subjects";

export const ACADEMIC_POLICY = {
  version: "factory-academic-policy/1.0.0",
  rules: [
    "Bind objectives to actual instruction and response tasks, not only scene tags. Export the coverage evidence.",
    "Worked examples show a method; guided tasks use new values and require a learner response.",
    "Use exact rational keys for fraction arithmetic. Equivalent unreduced fractions are accepted. Finite decimals must be exactly equal unless rounding is explicitly requested.",
    "Misconception feedback identifies the operation or inference causing the error and explains a repair.",
    "Teach and practise two-digit by two-digit multiplication with all four place-value partial products.",
    "Validate diagram axes, phases, plateaus, coexistence assumptions and relative energy intervals independently of text facts.",
    "A consequence can support a consequence claim. A direct-evidence question must ask explicitly for a stated action; no compulsory disputable inference.",
    "A geographic objective requires licensed coordinate-derived geometry; a county register proves recall only. No route claims without roads.",
    "Automated checks provide evidence, never academic approval, rights clearance or release authority.",
  ],
} as const;

export function misconceptionDescription(key: string) {
  if (key.includes("area-perimeter")) return { description: "Confuses interior area, boundary length or perpendicular height.", response: "Trace every boundary side and count interior unit squares; a triangle uses perpendicular height and half the surrounding rectangle." };
  if (key.includes("fractions")) return { description: "Adds denominators or treats a rounded decimal as an exact fraction.", response: "Preserve the whole and rename in equal-sized pieces. Distinguish exact equality from an explicitly requested approximation." };
  if (key.includes("multiplication")) return { description: "Omits cross-products or loses the place value of a tens multiplier.", response: "Split both factors into tens and ones; count all four rectangles and preserve the tens row value." };
  if (key.includes("science")) return { description: "Assumes heat always raises temperature or that evaporation requires boiling.", response: "A phase plateau absorbs latent heat at fixed temperature; surface evaporation can occur below boiling." };
  if (key.includes("civics")) return { description: "Confuses administrative prominence with capital status or infers geography from a list.", response: "Use the administrative register for capital names and coordinate-derived outlines for spatial claims; request roads for routes." };
  return { description: "Treats a consequence as if it explicitly names the action that caused it, or overgeneralizes a synthetic example.", response: "Match the exact claim to the quotation. Distinguish stated actions, consequences and the limits of the example." };
}

/** Reject specific regression patterns; does not certify the pedagogy. Called by the new LESSON_AUTHOR. */
export function validateAcademicCandidate(candidate: CandidateLessonV2, lesson: V4Lesson) {
  const blocks = candidate.scenes.flatMap(s => s.teaching?.blocks ?? []);
  const text = JSON.stringify(candidate);
  const fail = (code: string): never => { throw new Error(`draft6_academic:${code}`); };
  const requireBlock = (id: string): VisualBlock => blocks.find(b => "id" in b && b.id === id) ?? fail(`missing_task:${id}`);
  for (const block of blocks) {
    if (block.type === "SOURCE_EVIDENCE") {
      if (block.minSelect > block.sentences.filter(s => s.supports).length) fail("impossible_evidence_selection");
      if (block.source.kind === "PASSAGE") {
        const passage = blocks.filter(b => b.type === "READING_PASSAGE").flatMap(b => b.paragraphs).join(" ");
        for (const sentence of block.sentences) if (!passage.includes(sentence.text)) fail("quotation_not_in_passage");
      }
    }
    if (block.type === "CHECK") for (const item of block.items)
      if (!item.options.some(o => o.id === item.formativeKey.expectedOptionId) || item.options.some(o => o.feedback.length < 20)) fail("missing_diagnostic_feedback");
    if (block.type === "NUMERIC_RESPONSE") for (const part of block.parts)
      if (part.misconceptions.some(m => m.value === part.formativeKey.value)) fail("misconception_equals_answer");
  }
  if (lesson.key.includes("area-perimeter")) {
    const guided = requireBlock("guided-triangle"), worked = requireBlock("triangle-worked");
    if (!("shape" in guided) || !("shape" in worked) || JSON.stringify(guided.shape) === JSON.stringify(worked.shape)) fail("guided_copies_worked");
    const transfer = requireBlock("floor-transfer");
    if (transfer.type !== "NUMERIC_RESPONSE" || transfer.parts.some(p => !p.misconceptions.length) || !transfer.afterAttempt.some(t => t.includes("doorway"))) fail("transfer_diagnostic_missing");
  }
  if (lesson.key.includes("fractions")) {
    if (blocks.some(b => b.type === "NUMERIC_RESPONSE")) fail("decimal_only_fraction_key");
    for (const id of ["guided-one", "independent-six-fourths", "independent-compare", "like-sum", "like-difference", "related-sum", "related-difference"]) requireBlock(id);
    if (!text.includes("round") || !text.includes("exact") || !text.includes("area bars")) fail("fraction_objective_evidence_missing");
    const transfer = requireBlock("seed-remainder");
    if (transfer.type !== "CHECK" || transfer.items[0].options.find(o => o.id === "other")?.feedback.includes("size of the pieces")) fail("rounding_misdiagnosed");
  }
  if (lesson.key.includes("multiplication")) {
    const area = requireBlock("two-digit-area");
    if (area.type !== "AREA_MODEL" || area.splitA?.length !== 2 || area.splitB?.length !== 2) fail("four_partial_rectangles_required");
    for (const id of ["independent-product-one", "independent-product-two"]) {
      const block = requireBlock(id);
      if (block.type !== "NUMERIC_RESPONSE" || block.mode !== "INDEPENDENT" || !block.afterAttempt[0].includes("Total")) fail("two_digit_independent_missing");
    }
  }
  if (lesson.subject === "SCIENCE") {
    const plot = requireBlock("pure-water-heating");
    if (plot.type !== "DATA_PLOT" || plot.x.label !== "Net heat added" || JSON.stringify(plot.series) !== JSON.stringify(HEATING_POINTS)) fail("heating_curve_physics");
    // Independent dimensional check using approximate c_ice=2.1, c_water=4.18, Lf=334, Lv=2256 kJ/kg.
    if (HEATING_POINTS[1].x !== 2.1 * 10 || HEATING_POINTS[2].x - HEATING_POINTS[1].x !== 334 || HEATING_POINTS[3].x - HEATING_POINTS[2].x !== 418 || HEATING_POINTS[4].x - HEATING_POINTS[3].x !== 2256) fail("heat_intervals_invalid");
    if (blocks.some(b => b.type === "PARTICLE_MODEL" || b.type === "PREDICT_OBSERVE")) fail("unvalidated_temperature_only_animation");
    if (!text.includes("Latent heat") || !text.includes("below boiling") || !text.includes("mixture")) fail("physical_explanation_missing");
    const properties = requireBlock("particle-properties");
    if (properties.type !== "CHECK" || properties.items.length !== 3 || !properties.items.every(p => p.options.some(o => o.id === p.formativeKey.expectedOptionId && /particles|Particles/.test(o.text) && /shape/.test(o.text) && /volume/.test(o.text)))) fail("states_properties_incomplete");
    requireBlock("freezing-energy");
    const task = candidate.scenes.find(s => s.teaching?.phase === "OBSERVE");
    if (task?.interaction.kind !== "FREE_RESPONSE" || !task.interaction.prompts.some(p => /arrangement, motion, shape and volume/.test(p.prompt))) fail("state_comparison_practice_missing");
  }
  if (lesson.subject === "CIVICS" && blocks.some(b => b.type === "MAP_EXPLORER")) fail("schematic_cannot_teach_geography");
  if (lesson.subject === "ENGLISH") {
    const evidence = requireBlock("direct-evidence");
    if (evidence.type !== "SOURCE_EVIDENCE" || evidence.minSelect !== 1 || evidence.sentences.find(s => s.id === "consequence")?.supports !== false) fail("direct_consequence_conflated");
    if (!text.includes("informational") || blocks.some(b => b.type === "READING_PASSAGE" && b.glossary.length)) fail("genre_or_answer_revealing_glossary");
  }
  return { policy: ACADEMIC_POLICY.version, status: "AUTOMATED_REGRESSION_CHECKS_PASS", academicApproval: false };
}
