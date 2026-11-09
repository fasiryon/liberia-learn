import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import type { V4Lesson } from "@/lib/curriculum/v4/candidates";

/** Reviewer-only examples, never protected assessment keys. Writing is judged by reasoning, not exact wording. */
const responses: Record<string, Record<string, string[]>> = {
  "g7-math-area-perimeter": {
    SOLVE_WITH_SUPPORT: ["The 9 by 4 plot has area 36 square metres and perimeter 26 metres. A square metre is an interior patch; a metre measures length. The triangle has area 12 square metres and perimeter 18 metres."],
    APPLY: ["The doorway removes 2 m of boundary skirting, not any of the 12 by 6 floor. Covering is 72 square metres; skirting is 36 - 2 = 34 metres. If a student subtracts 2 from 72, ask them to distinguish a length from an area."],
  },
  "g7-math-fractions": {
    VISUALIZE: ["One bar is one kilogram and each interval of length one is one kilogram. Mark 1 at 4/4, and 3/2 at six quarters, or one and a half equal bars. Two extra quarters beyond one explain why 3/2 > 1."],
    SOLVE_WITH_SUPPORT: ["Shade a full four-quarter bar and two quarters of an equal bar. Mark six quarter-steps from zero at 1.5. The amount is 6/4 of the named whole, so it exceeds 1."],
    PRACTICE_INDEPENDENTLY: ["1/2 < 5/8 < 3/4 because they are 4/8, 5/8 and 6/8. All lie between the one-half and one benchmarks. A number line shows this order left to right.", "3/4 + 1/8 = 6/8 + 1/8 = 7/8. Accept 14/16 and exact decimal 0.875. For 6/4 show one full bar and two quarter-pieces of an equal bar. The whole must be fixed and named."],
    APPLY: ["3/4 - 1/3 = 9/12 - 4/12 = 5/12 kg. Accept any exactly equivalent fraction. The explicit two-place estimate is approximately 0.42 kg. It is positive because 9 > 4 and below 3/4 because a positive amount was removed. Do not equate 0.42 with 5/12."],
  },
  "math-multiplication-models": { APPLY: ["18 x 14 = 180 + 72 = 252 chairs; 252 - 12 = 240 audience chairs. Multiplication counts all seats before reserving them. The 20 x 14 = 280 estimate is larger, as expected. Diagnose 252 as forgetting the reservation, and 72 as counting only 18 x 4."] },
  "g7-science-states-of-matter": {
    EXPERIMENT: ["At 21 kJ the ice has reached 0 C and melting is starting; at 355 kJ melting is complete. The interval transfers 334 kJ while temperature stays at 0 C. Mass and pressure are held fixed. At interior points of this interval, solid and liquid coexist."],
    OBSERVE: ["B-C, 21 to 355 kJ, is melting at 0 C with solid and liquid present. D-E, 773 to 3029 kJ, is boiling at 100 C with liquid and vapor present. C-D, 355 to 773 kJ, warms the liquid.", "No. The horizontal axis is heat in kilojoules. Time would require net heating power or measured times. A flat temperature segment does not show heating stopped.", "Ice particles vibrate about fixed positions in an open solid structure, giving a fixed shape and approximately fixed volume. Liquid particles remain close but move past neighbors, giving a changing container shape and nearly fixed volume. Vapor particles are far apart and move randomly; gas fills available space with no own fixed shape or volume. Pouring water preserves its volume if none spills, while gas expands to fill a changed container. Accept equivalent accurate explanations with examples."],
    APPLY: ["Compare equally cold sealed containers with different contents, first drying their outsides and keeping air conditions similar. Droplets on both support condensation from surrounding air; leakage should depend on contents or a leak. Other fair, safe tests with a stated discriminating result are acceptable. Condensation releases energy to the cold surface; evaporation of outside droplets can reverse it. A drying cloth absorbs energy from its surroundings; vapor condensing can reverse vaporization."],
  },
  "g7-civics-counties-capitals": {
    EXPLORE: ["Use the geographic map and key together to associate each numbered polygon with its county. This is supported exploration, not an independent mastery score. County numbers label areas; no capital points are plotted."],
    INVESTIGATE: ["8 is Lofa, Voinjama; 10 is Maryland, Harper; 12 is Nimba, Sanniquellie. Lofa lies farthest north among these county areas. Recall comes from the register; position comes from the outline."],
    COMPARE: ["Use county-capitals.json for the complete fifteen-pair answer key, with map numbering 1 to 15. Bensonville and Bentol are accepted Montserrado capital variants; River Cess/Rivercess name variants are recognized. Mark county identification separately from capital recall. A correct name alone cannot establish spatial mastery.", "Lofa lies farther north than Maryland. Maryland touches the Atlantic coast at Liberia's southeastern end. The outline's orientation and coastal boundary support these claims. Colors and key order are not evidence."],
    REASON: ["North-up coordinate-derived boundaries encode spatial position. An administrative register supplies name pairs without positions. A spatial comparison needs the former; a list alone cannot support it."],
    APPLY: ["Request a current road map with route geometry, county boundaries, capital coordinates and current condition/passability information. Lofa's capital is Voinjama and Maryland's is Harper; Lofa is north of Maryland and Maryland is coastal. Do not infer that a route passes a capital just because it crosses its county."],
  },
  "g7-english-reading-evidence": {
    UNDERSTAND: ["Unsuitable means not fit or appropriate for planting here. The preceding mould explanation provides the clue. Accept a fresh sentence such as 'Cracked containers are unsuitable for carrying water' with an explanation. Do not require a memorized definition.", "Damp storage can damage seeds through mould. The exact passage sentence about damp seeds supports dry storage. Accept other relevant quotations with a sound causal explanation; ask students who only mention the cupboard to explain why dryness matters."],
    ANALYZE: ["The sentence about more pupils borrowing next season directly states the access consequence. The seed-return sentence can also support later availability with an explained link. Accept either defensible quotation; only the earlier closed question about explicitly naming family actions has one compulsory answer."],
    REVISE: ["Accept any accurate original/revised sentence pair with an explained improvement in quotation accuracy, claim scope or reasoning. For example, replace 'All seed libraries always succeed' with 'In this example, returning seeds can support borrowing next season.' Classify the cited detail as an action or consequence according to its content, allowing explained distinctions."],
  },
};

export function reviewGuidance(lesson: V4Lesson, candidate: CandidateLessonV2) {
  return candidate.scenes.flatMap(scene => {
    const phase = scene.teaching?.phase ?? "ASSESS";
    const answers = responses[lesson.key]?.[phase] ?? [];
    const prompts = scene.interaction.kind === "FREE_RESPONSE" ? scene.interaction.prompts : [];
    if (prompts.length !== answers.length) throw Error(`review_answer_coverage:${lesson.key}:${phase}:${prompts.length}:${answers.length}`);
    return [
      ...prompts.map((prompt, index) => ({ responseId: prompt.id, question: prompt.prompt, acceptableReasoning: answers[index], feedbackTiming: "AFTER_ATTEMPT", feedback: "Use the example reasoning to locate the unsupported step; accept different wording with valid evidence. This is formative feedback, not an official mark." })),
      ...(scene.teaching?.blocks ?? []).filter(b => b.type === "WRITING_ORGANIZER").map(block => ({ responseId: block.id, question: block.prompt,
        acceptableReasoning: lesson.subject === "ENGLISH" ? "Accept any of the offered claims if the quotation is exact, the explanation connects it to the claim, and scope stays within the invented example. Revision must improve an identifiable weakness. No single model paragraph is compulsory."
          : lesson.subject === "SCIENCE" ? "Water vapor from air condenses on the cold cup and releases energy; cloth water evaporates below boiling using energy from surroundings. Particle identity persists. Explain reversible state changes and a discriminating condensation/leak test."
          : "Voinjama is Lofa's capital and Harper is Maryland's. Map position puts Lofa north of Maryland; Maryland has an Atlantic coast. Current roads, capital coordinates and passability remain unknown.",
        feedbackTiming: "AFTER_ATTEMPT", feedback: "Check each reasoning criterion separately and request a targeted revision; do not reject a defensible alternative for differing wording." })),
    ];
  });
}

/** Concrete teaching/task bindings, independently reviewed alongside the content. */
const coverage: Record<string, { taught: string[]; practised: string[] }[]> = {
  "g7-math-area-perimeter": [{ taught: ["garden-model", "rectangle-worked"], practised: ["guided-rectangle", "independent-rectangle", "floor-transfer"] }, { taught: ["triangle-model", "triangle-worked"], practised: ["guided-triangle", "independent-triangle"] }],
  "g7-math-fractions": [{ taught: ["whole-bar", "extra-quarter", "five-fourths-line"], practised: ["generated-1-response-0", "guided-one", "generated-3-response-0", "independent-six-fourths", "generated-4-response-1"] }, { taught: ["fraction-add-worked"], practised: ["like-sum", "related-sum", "like-difference", "related-difference", "seed-remainder"] }, { taught: ["fraction-compare-worked"], practised: ["independent-compare", "generated-4-response-0"] }],
  "math-multiplication-models": [{ taught: ["equal-groups", "generated-1"], practised: ["groups-guided", "groups-independent"] }, { taught: ["two-digit-area", "multiply-worked"], practised: ["guided-area", "guided-product-one", "independent-product-one", "independent-product-two", "seating-total"] }],
  "g7-science-states-of-matter": [{ taught: ["particle-properties", "generated-4"], practised: ["state-properties", "generated-3-response-2", "water-transfer"] }, { taught: ["generated-4"], practised: ["freezing-energy", "evaporation-check", "water-transfer"] }, { taught: ["pure-water-heating", "generated-4"], practised: ["generated-3-response-0", "generated-3-response-1", "latent-heat-check", "water-transfer"] }],
  "g7-civics-counties-capitals": [{ taught: ["county-register", "asset:liberia-county-map.svg"], practised: ["generated-2-response-0", "generated-3-response-0", "asset:liberia-county-outline-task.svg"] }, { taught: ["generated-2"], practised: ["montserrado-capital", "nimba-capital"] }, { taught: ["asset:liberia-county-map.svg", "generated-4"], practised: ["generated-3-response-1", "county-transfer"] }],
  "g7-english-reading-evidence": [{ taught: ["seed-passage", "generated-2"], practised: ["literal-record", "generated-2-response-0", "generated-2-response-1"] }, { taught: ["generated-3"], practised: ["direct-evidence", "generated-3-response-0"] }, { taught: ["generated-2", "generated-4", "generated-5"], practised: ["seed-writing", "seed-revision", "generated-5-response-0"] }],
};
export function objectiveCoverage(lesson: V4Lesson, candidate: CandidateLessonV2) {
  const bindings = coverage[lesson.key];
  if (bindings.length !== lesson.objectives.length) throw Error(`objective_coverage_missing:${lesson.key}`);
  const ids = new Set(candidate.scenes.flatMap(s => [s.id, ...(s.teaching?.blocks ?? []).flatMap(b => "id" in b ? [b.id] : []), ...(s.interaction.kind === "FREE_RESPONSE" ? s.interaction.prompts.map(p => p.id) : [])]));
  return lesson.objectives.map((objective, i) => {
    const binding = bindings[i];
    for (const id of [...binding.taught, ...binding.practised]) if (!id.startsWith("asset:") && !ids.has(id)) throw Error(`objective_task_missing:${id}`);
    return { objectiveId: objective.id, statement: objective.statement, ...binding, runtimeStatus: lesson.subject === "CIVICS" ? "REQUIRES_T1_GEOGRAPHIC_ASSET_INTEGRATION" : "REVIEW_REQUIRED", masteryClaim: false };
  });
}
