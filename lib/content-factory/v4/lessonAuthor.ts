import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import type { CandidateLessonV2, CandidateScene } from "@/lib/curriculum/v2/contract";
import type { V4Lesson } from "@/lib/curriculum/v4/candidates";
import { V4_INSTRUCTION_STANDARD, INDEPENDENT_PHASES, type InstructionPhase } from "@/lib/learner-experience/teaching/instruction";
import { blockTextAlternative, type VisualBlock, type BlockOf } from "@/lib/learner-experience/teaching/registry";
import { shapeArea, shapePerimeter } from "@/lib/learner-experience/teaching/models/geometry";
import { LIBERIA_COUNTIES } from "@/lib/learner-experience/teaching/models/liberiaCounties";

/** Versioned LESSON_AUTHOR recipe. No reference candidate JSON is read or copied. */
export const LESSON_AUTHOR_VERSION = "factory-v4-lesson-author/1.0.0";
export const AUTHORING_PLAN = Object.freeze({
  geometry: { rectangle: { length: 8, width: 5 }, triangle: { base: 6, height: 4, apexOffset: 3 }, independentRectangle: { length: 11, width: 7 } },
  fractions: { numerator: 2, denominator: 3, otherNumerator: 3, otherDenominator: 4 },
  multiplication: { groups: 7, groupSize: 4, factorA: 24, factorB: 6, independent: [[32, 4], [17, 8]] },
  science: { startC: -5, endC: 20, pressure: "approximately one atmosphere", dataKind: "ILLUSTRATIVE" },
  civics: { compare: ["bong", "montserrado"], map: "LIBERIA_COUNTIES_SCHEMATIC" },
  english: { title: "The seed library", paragraphs: [
    "When the dry season ended, Satta found three empty seed tins beside the school garden. She asked each family to bring a small share of seeds. On Friday, the class labelled the tins and wrote down who had contributed.",
    "A younger pupil worried that only families with money could help. Satta pointed to the list. Some families had given seeds, some had cleaned tins, and others had taught the class when to plant. By the next week, every pupil could borrow seeds and promise to return some after the harvest.",
  ] },
});
const origin = { kind: "ORIGINAL_FOR_LIBERIALEARN" as const, license: "Original synthetic demonstration; internal review only", attribution: "LiberiaLearn Content Factory V4 deterministic author" };
type ScenePlan = { phase: InstructionPhase; title: string; body: string; blocks: VisualBlock[]; action?: string; prompts?: string[] };
const option = (id: string, text: string, feedback: string) => ({ id, text, feedback });

function buildScene(plan: ScenePlan, index: number, lesson: V4Lesson, misconceptionId: string): CandidateScene {
  const id = `generated-${index + 1}`, independent = INDEPENDENT_PHASES.has(plan.phase);
  const worked = plan.phase === "DEMONSTRATE", guided = ["SOLVE_WITH_SUPPORT", "EXPLAIN", "UNDERSTAND", "INVESTIGATE"].includes(plan.phase);
  const action = plan.action ?? (plan.prompts ? plan.prompts.join(" ").slice(0, 390) : "Use the model, complete its task, and explain what the representation shows.");
  return { id, type: worked ? "GUIDED_EXAMPLE" : independent || guided || plan.prompts ? "PRACTICE" : "EXPLANATION",
    title: plan.title, purpose: worked ? "MODEL_WORKED_EXAMPLE" : plan.phase === "ANALYZE_MISTAKE" ? "ADDRESS_MISCONCEPTION" : guided ? "GUIDED_PRACTICE" : independent ? "INDEPENDENT_PRACTICE" : "EXPLAIN_CONCEPT",
    objectiveIds: lesson.objectives.map(o => o.id), learnerAction: action, content: { body: plan.body },
    interaction: plan.prompts ? { kind: "FREE_RESPONSE", prompts: plan.prompts.map((prompt, i) => ({ id: `${id}-response-${i}`, prompt, minLength: 20 })) } : { kind: "NONE" },
    tools: { requested: [], prohibited: [] }, hints: [], misconceptionIds: [misconceptionId],
    evidence: { kind: "NONE" },
    accessibility: { textAlternative: [plan.body, ...plan.blocks.map(blockTextAlternative), ...(plan.prompts ?? [])].join(" ").slice(0, 2400),
      keyboardPath: "Tab to each labelled control. Use arrow keys and Space to select; type responses; activate Check or Show next step with Enter.", reducedMotion: "STATIC_EQUIVALENT" },
    offline: { mode: "FULL_OFFLINE", note: "Models and formative checks use cached lesson data. Paper responses are capture only; no official grade is produced." },
    completion: plan.prompts ? "ALL_RESPONSES_WRITTEN" : "VIEWED",
    pedagogy: { strategy: "GUIDED_TO_INDEPENDENT", representation: "MIXED", scaffoldLevel: independent || plan.phase === "OBSERVE" || plan.phase === "COMPARE" || plan.phase === "ANALYZE" ? "NONE" : guided ? "PARTIAL" : "FULL" },
    teaching: { phase: plan.phase, blocks: plan.blocks },
  };
}

function numeric(id: string, mode: "GUIDED" | "INDEPENDENT", prompt: string, values: { label: string; value: number; wrong?: number }[], misconceptionId: string): BlockOf<"NUMERIC_RESPONSE"> {
  return { type: "NUMERIC_RESPONSE", id, mode, prompt,
    parts: values.map((p, i) => ({ id: `${id}-${i}`, label: p.label, quantity: "OTHER", unit: { kind: "NONE", base: "" },
      formativeKey: { value: p.value, tolerance: 1e-9 }, misconceptions: p.wrong === undefined || p.wrong === p.value ? [] : [{ value: p.wrong, feedback: "Compare your operation with what the model represents. Explain each part before calculating again.", misconceptionId }] })),
    hints: mode === "GUIDED" ? ["Name the quantities and represent them before calculating.", "Use the worked model, then check your result with a second representation."] : [],
    afterAttempt: values.map(p => `${p.label}: ${p.value}. Explain how the model and your calculation agree.`),
  };
}

function mistake(id: string, m: string, problem: string, wrong: string, reason: string): BlockOf<"MISTAKE_ANALYSIS"> {
  return { type: "MISTAKE_ANALYSIS", id, problem, attempt: { name: "A learner", steps: [wrong] }, question: "Which diagnosis explains the mistake?",
    options: [option("model", reason, "Use the representation to explain why this method needs to change."), option("keep", "The method already matches the model.", "Check what each quantity in the model means.")],
    formativeKey: { expectedOptionId: "model" }, correction: [reason, "Rebuild the model and explain a method that agrees with it."], misconceptionId: m };
}

function geometry(m: string): ScenePlan[] {
  const p = AUTHORING_PLAN.geometry;
  const rect = { kind: "RECTANGLE" as const, ...p.rectangle, unit: "m" };
  const tri = { kind: "TRIANGLE" as const, ...p.triangle, unit: "m", sideLabels: [5, 5] as [number, number] };
  const task = (id: string, mode: "GUIDED" | "INDEPENDENT", shape: typeof rect | typeof tri): BlockOf<"NUMERIC_RESPONSE"> => ({
    type: "NUMERIC_RESPONSE", id, mode, prompt: "Find the area and the perimeter. Explain why their units differ.", shape,
    parts: [{ id: `${id}-area`, label: "Area", quantity: "AREA", unit: { kind: "AREA", base: "m" }, formativeKey: { value: shapeArea(shape) }, misconceptions: [{ value: shapePerimeter(shape)!, feedback: "You measured the edge. Area counts squares covering the inside.", misconceptionId: m }] },
      { id: `${id}-edge`, label: "Perimeter", quantity: "PERIMETER", unit: { kind: "LENGTH", base: "m" }, formativeKey: { value: shapePerimeter(shape)! }, misconceptions: [{ value: shapeArea(shape), feedback: "You covered the inside. Perimeter measures every side of the boundary.", misconceptionId: m }] }],
    hints: mode === "GUIDED" ? ["Trace the edge for perimeter; shade the inside for area.", "A triangle occupies half its base-by-height rectangle."] : [],
    afterAttempt: [`Area = ${shapeArea(shape)} square metres. Perimeter = ${shapePerimeter(shape)} metres.`, "Explain which measurement would buy fencing and which would buy ground covering."],
  });
  return [
    { phase: "VISUALIZE", title: "Covering and fencing", body: "Synthetic school-garden demonstration. Count square metres inside the rectangle and trace metres around its boundary. A triangle with base 6 m and perpendicular height 4 m fills half a 6-by-4 rectangle. Its sloping sides are 5 m each.", blocks: [
      { type: "SHAPE_MODEL", id: "garden-model", shape: rect, views: ["GRID", "AREA", "PERIMETER"], explore: true, caption: "Area covers the inside; perimeter follows the edge." },
      { type: "SHAPE_MODEL", id: "triangle-model", shape: tri, views: ["HEIGHT", "AREA"], explore: false, caption: "Use perpendicular height, not a sloping side." }] },
    { phase: "DEMONSTRATE", title: "Explain both measurements", body: "Watch the method before trying a new garden. Multiplication counts square units. Addition measures the boundary. The same number can never stand for both measurements without stating its unit.", blocks: [
      { type: "WORKED_SOLUTION", id: "rectangle-worked", problem: "An 8 m by 5 m garden needs mulch and fencing.", shape: rect, steps: [
        { text: "Count 5 rows of 8 unit squares.", tex: `A=8\\times5=${shapeArea(rect)}\\text{ m}^2`, views: ["AREA"] },
        { text: "Add all four sides.", tex: `P=2(8+5)=${shapePerimeter(rect)}\\text{ m}`, views: ["PERIMETER"] }] },
      { type: "WORKED_SOLUTION", id: "triangle-worked", problem: "Find both measurements of the triangular bed.", shape: tri, steps: [
        { text: "Halve the base-by-height rectangle.", tex: `A=\\frac{1}{2}\\times6\\times4=${shapeArea(tri)}\\text{ m}^2`, views: ["HEIGHT", "AREA"] },
        { text: "Add the three boundary lengths, not the height.", tex: `P=6+5+5=${shapePerimeter(tri)}\\text{ m}`, views: ["PERIMETER"] }] }] },
    { phase: "SOLVE_WITH_SUPPORT", title: "Try both shapes with support", body: "State what must be measured before choosing a method. Units are part of your answer.", blocks: [task("guided-rectangle", "GUIDED", { ...rect, length: 9, width: 4 }), task("guided-triangle", "GUIDED", tri)] },
    { phase: "PRACTICE_INDEPENDENTLY", title: "Measure new plots independently", body: "Solve each problem independently and justify the units. Feedback appears only after an attempt.", blocks: [task("independent-rectangle", "INDEPENDENT", { ...rect, ...p.independentRectangle }), task("independent-triangle", "INDEPENDENT", { ...tri, base: 10, height: 12, apexOffset: 5, sideLabels: [13, 13] })] },
    { phase: "ANALYZE_MISTAKE", title: "Diagnose the garden estimate", body: "Inspect the claim and explain which measurement the method actually produces.", blocks: [mistake("garden-mistake", m, "A 10 m by 4 m plot needs fencing.", "Buy 40 metres of fencing because 10 times 4 is 40.", "Multiplying side lengths finds area; fencing needs the sum of all boundary lengths.")] },
    { phase: "APPLY", title: "Transfer to a floor plan", body: "A synthetic classroom extension has a rectangular floor 12 m by 6 m. A doorway removes 2 m from the skirting board boundary. Determine floor covering and skirting board needed.", blocks: [numeric("floor-transfer", "INDEPENDENT", "Find the quantities for a new job.", [{ label: "Floor covering in square metres", value: 12 * 6 }, { label: "Skirting board in metres", value: 2 * (12 + 6) - 2 }], m)], prompts: ["Explain why the doorway changes the skirting length but does not remove a rectangle from the floor covering."] },
  ];
}

function fractions(m: string): ScenePlan[] {
  const { numerator: n, denominator: d, otherNumerator: p, otherDenominator: q } = AUTHORING_PLAN.fractions;
  return [
    { phase: "VISUALIZE", title: "Same whole, equal parts", body: "Synthetic sharing demonstration. A fraction measures equal parts of one fixed whole. Repartitioning changes the names of the parts without changing the amount. Compare two thirds and three quarters only when the wholes have the same size.", blocks: [
      { type: "FRACTION_MODEL", id: "fraction-whole", representation: "BAR", parts: d, shaded: n, interaction: "EXPLORE", caption: "Split a whole into equal parts." },
      { type: "FRACTION_EQUIVALENCE", id: "fraction-equivalent", base: { numerator: n, denominator: d }, factors: [2, 4], caption: "Multiply the count of parts and the count of equal pieces by the same factor." }] },
    { phase: "DEMONSTRATE", title: "Build a common unit", body: "A denominator names the unit being counted. Use equal-sized pieces before combining or comparing their counts. The size of the whole stays fixed.", blocks: [
      { type: "WORKED_SOLUTION", id: "fraction-worked", problem: `Compare $\\frac{${n}}{${d}}$ and $\\frac{${p}}{${q}}$.`, steps: [
        { text: "Use twelfths for both quantities.", tex: `\\frac{${n}}{${d}}=\\frac{${n * q}}{${d * q}},\\quad\\frac{${p}}{${q}}=\\frac{${p * d}}{${q * d}}` },
        { text: "With the same unit, compare the counts.", tex: `\\frac{${n * q}}{${d * q}}<\\frac{${p * d}}{${q * d}}` }] },
      { type: "WORKED_SOLUTION", id: "fraction-add-worked", problem: "Add one half and one quarter.", steps: [{ text: "Rename one half as two quarters.", tex: "\\frac{1}{2}=\\frac{2}{4}" }, { text: "Count quarters, keeping the size of the pieces.", tex: "\\frac{2}{4}+\\frac{1}{4}=\\frac{3}{4}" }] }] },
    { phase: "SOLVE_WITH_SUPPORT", title: "Combine equal pieces with support", body: "Sketch each quantity on equal wholes, rename to a common denominator, then count pieces.", blocks: [numeric("fraction-guided", "GUIDED", "Write a fraction or an equivalent decimal.", [{ label: "One half plus one third", value: 1 / 2 + 1 / 3, wrong: 2 / 5 }, { label: "Two thirds plus one sixth", value: 2 / 3 + 1 / 6, wrong: 3 / 9 }], m)] },
    { phase: "PRACTICE_INDEPENDENTLY", title: "Calculate independently", body: "Draw your own model if it helps. Explain why your result is reasonable.", blocks: [numeric("fraction-independent", "INDEPENDENT", "Solve without hints.", [{ label: "Three quarters plus one eighth", value: 3 / 4 + 1 / 8, wrong: 4 / 12 }, { label: "Five sixths minus one third", value: 5 / 6 - 1 / 3, wrong: 4 / 3 }], m)] },
    { phase: "ANALYZE_MISTAKE", title: "Find the changed unit", body: "A method must preserve the size of the fraction pieces.", blocks: [mistake("fraction-mistake", m, "Add one half and one third.", "One half plus one third is two fifths.", "Adding denominators changes the unit; first express both quantities as sixths.")] },
    { phase: "APPLY", title: "Transfer to seed measurements", body: "Synthetic seed-bank task. A group has three quarters of a kilogram of seed and packs one third of a kilogram for a new garden.", blocks: [numeric("seed-transfer", "INDEPENDENT", "How much seed remains?", [{ label: "Kilograms remaining", value: 3 / 4 - 1 / 3 }], m)], prompts: ["Explain how a common unit lets you subtract these quantities, and why the remainder must be smaller than three quarters."] },
  ];
}

function multiplication(m: string): ScenePlan[] {
  const p = AUTHORING_PLAN.multiplication, tens = Math.floor(p.factorA / 10) * 10, ones = p.factorA - tens;
  return [
    { phase: "VISUALIZE", title: "Equal groups and area", body: "Synthetic school-supply demonstration. Each row has the same number of counters. The number of rows times the size of each row counts all the counters. Splitting a rectangular array preserves the total and exposes place value.", blocks: [
      { type: "ARRAY_MODEL", id: "multiplication-groups", rows: p.groups, columns: p.groupSize, views: ["GROUPS", "ARRAY", "GRID"], adjustable: true, caption: "Explain why each representation has the same total." },
      { type: "AREA_MODEL", id: "multiplication-area", mode: "SHOW", factorA: p.factorA, factorB: p.factorB, splitA: [tens, ones], prompt: "Watch the rectangle split into tens and ones." }] },
    { phase: "DEMONSTRATE", title: "Use the distributive property", body: "Both partial rectangles must be counted. Multiplication distributes over addition because the two non-overlapping rectangles cover exactly the original array.", blocks: [{ type: "WORKED_SOLUTION", id: "multiplication-worked", problem: `Find $${p.factorA}\\times${p.factorB}$.`, steps: [
      { text: "Split the first factor by place value.", tex: `${p.factorA}=${tens}+${ones}` },
      { text: "Multiply both parts, then add their products.", tex: `${tens}\\times${p.factorB}+${ones}\\times${p.factorB}=${tens * p.factorB}+${ones * p.factorB}=${p.factorA * p.factorB}` }] }] },
    { phase: "SOLVE_WITH_SUPPORT", title: "Multiply with support", body: "Separate tens and ones. Label both partial products before combining them.", blocks: [numeric("multiply-guided", "GUIDED", "Use equal groups or a split array.", [{ label: "23 times 4", value: 23 * 4, wrong: 20 * 4 + 3 }, { label: "16 times 5", value: 16 * 5, wrong: 10 * 5 + 6 }], m)] },
    { phase: "PRACTICE_INDEPENDENTLY", title: "Choose your own method", body: "Compute both products and give a place-value reason for your method.", blocks: [numeric("multiply-independent", "INDEPENDENT", "Solve independently.", p.independent.map(([a, b]) => ({ label: `${a} times ${b}`, value: a * b, wrong: Math.floor(a / 10) * 10 * b + a % 10 })), m)] },
    { phase: "ANALYZE_MISTAKE", title: "Find the missing product", body: "Check that every part of the original array has been counted.", blocks: [mistake("multiply-mistake", m, "Find 24 times 6.", "20 times 6 plus 4 equals 124.", "The four ones must also be multiplied by six; add 120 and 24.")] },
    { phase: "APPLY", title: "Transfer to seating", body: "Synthetic community-meeting plan. There are 18 rows of 7 chairs. Reserve 12 chairs for presenters.", blocks: [numeric("seating-transfer", "INDEPENDENT", "How many chairs remain for the audience?", [{ label: "Audience chairs", value: 18 * 7 - 12 }], m)], prompts: ["Explain why you multiply before removing the reserved chairs, and check the result with a second method."] },
  ];
}

const check = (id: string, m: string, prompt: string, yes: string, no: string, why: string): BlockOf<"CHECK"> => ({ type: "CHECK", id, items: [{ id: `${id}-item`, prompt, options: [option("reason", yes, why), option("other", no, "Compare this claim with the model and its evidence.")], formativeKey: { expectedOptionId: "reason" }, misconceptionId: m }] });
const organizer = (id: string, prompt: string, sourceBlockId?: string): BlockOf<"WRITING_ORGANIZER"> => ({ type: "WRITING_ORGANIZER", id, prompt, ...(sourceBlockId ? { sourceBlockId } : {}), fields: [
  { id: "claim", label: "Claim", guidance: "State your conclusion precisely.", minWords: 8 }, { id: "evidence", label: "Evidence and reasoning", guidance: "Quote or describe relevant evidence and explain the link to your claim.", minWords: 15 }], checklist: ["My evidence supports my claim.", "I explained the reasoning and checked an alternative."] });

function science(m: string): ScenePlan[] {
  const p = AUTHORING_PLAN.science;
  return [
    { phase: "PREDICT", title: "Predict a change of state", body: "Synthetic water-model demonstration at approximately one atmosphere. Predict first. The simulation simplifies a pure substance and is not a safe procedure for heating water. A prediction is a reasoned claim to test, not a fact established by the animation.", blocks: [{ type: "PREDICT_OBSERVE", id: "water-prediction", prompt: "What happens to ice as it warms from -5 degrees C to 20 degrees C?", options: [option("melt", "It melts; the particles remain water particles.", "Energy changes particle movement and arrangement."), option("grow", "The particles themselves grow into liquid particles.", "Particles remain the same substance during a physical change.")], formativeKey: { expectedOptionId: "melt" }, simulation: { startC: p.startC, endC: p.endC }, observation: "In this simplified model, solid water becomes liquid near 0 degrees C. Particles move past one another; they do not become larger particles.", explainPrompt: "Compare your prediction with the observation and explain the role of energy.", explainMinChars: 20 }] },
    { phase: "EXPERIMENT", title: "Change one model variable", body: "Keep the substance and pressure fixed while changing temperature. Watch arrangement and motion. Real water can contain ice and liquid together during melting; a temperature slider alone does not model the time or energy needed for that phase change.", blocks: [{ type: "PARTICLE_MODEL", id: "water-particles", substance: "WATER", startC: -5, minC: -10, maxC: 110, caption: "Change temperature and compare solid, liquid and gas representations. This is a simplified model, not measured data." }] },
    { phase: "OBSERVE", title: "Read observations independently", body: "Illustrative heating data, not a real experiment. These points show a simplified melting interval for pure water near one atmosphere. The temperature stays near zero while added energy changes the state.", blocks: [{ type: "DATA_PLOT", id: "melting-data", title: "Illustrative ice heating", x: { label: "Time", unit: "min" }, y: { label: "Temperature", unit: "C" }, series: [{ x: 0, y: -5 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 10 }], data: { kind: "ILLUSTRATIVE", note: "Synthetic demonstration values, not collected observations." }, caption: "A plateau can indicate a phase change; these data alone do not establish how much energy was supplied." }], prompts: ["Describe the interval from minute 1 to minute 3 using only the plotted evidence.", "Explain why a temperature plateau does not mean energy transfer has stopped."] },
    { phase: "EXPLAIN", title: "Explain with particles", body: "Worked reasoning: a liquid changes container shape because its particles can move past one another. A solid keeps its shape because its particles remain arranged around fixed positions while vibrating. A gas spreads because its particles are widely spaced and moving freely. Particle identity does not change during these physical changes.", blocks: [check("particles-check", m, "Which explanation fits a liquid changing container shape?", "Particles move past one another.", "The particles turn into a new substance.", "Movement and arrangement explain the observation without changing particle identity."), check("energy-check", m, "Why can ice keep melting at about zero degrees C?", "Energy changes particle arrangement during melting.", "No energy reaches the ice.", "Latent energy changes state while temperature remains approximately constant.")] },
    { phase: "APPLY", title: "Transfer to a cool container", body: "A synthetic observation: droplets appear on the outside of a cold sealed bottle. No water is observed leaking from its cap.", blocks: [organizer("condensation-reasoning", "Use particles and energy to explain the droplets and propose a fair test against the leak explanation.")], prompts: ["Predict what would happen around an equally cold dry metal container, and explain how that result would distinguish two explanations."] },
  ];
}

function civics(m: string): ScenePlan[] {
  const selected = AUTHORING_PLAN.civics.compare.map(id => { const county = LIBERIA_COUNTIES.find(c => c.id === id); if (!county) throw Error("county_not_in_model"); return county; });
  return [
    { phase: "EXPLORE", title: "Read a schematic county map", body: "Explore the names and capital labels on this schematic. It is not a survey map: do not infer exact boundaries, distance, area or population from the shapes. The county and capital list is a repository reference awaiting independent authoritative-source attestation.", blocks: [{ type: "MAP_EXPLORER", id: "counties-explore", map: "LIBERIA_COUNTIES_SCHEMATIC" }] },
    { phase: "INVESTIGATE", title: "Find places with support", body: "Use the labelled map and name list. Distinguish a county from the city named as its capital. Map size provides no population evidence.", blocks: [...selected.map((c, i): VisualBlock => ({ type: "MAP_EXPLORER", id: `county-task-${i}`, map: "LIBERIA_COUNTIES_SCHEMATIC", task: { prompt: `Locate ${c.name}, whose capital is ${c.capital}.`, formativeKey: { regionId: c.id }, success: `The map pairs ${c.name} with ${c.capital}; the county and its capital are different geographic units.` } })), check("county-scope", m, "Does the drawn size of a tile establish population?", "No; use an authoritative population table.", "Yes; larger tiles always mean more residents.", "The schematic encodes labels and approximate placement, not population.")] },
    { phase: "COMPARE", title: "Compare evidence independently", body: `The repository model lists ${selected.map(c => `${c.name}: ${c.capital}`).join("; ")}. Treat the schematic as a name-location aid, not a measurement of land or people.`, blocks: [], prompts: ["Compare the capital and county names in the two entries. Explain how the labels keep them distinct.", "Can a larger drawn county establish a larger population? Explain what additional source would be needed."] },
    { phase: "REASON", title: "Build a source-based claim", body: "Worked reasoning: a county-capital table supports a claim about administrative names. It does not establish travel time or population. A useful explanation states both what a source supports and what remains unknown.", blocks: [{ type: "SOURCE_EVIDENCE", id: "county-evidence", source: { title: "Synthetic source-comparison exercise", kind: "DOCUMENT", origin }, question: "Which statements justify checking a county-capital claim with a named source?", sentences: [
      { id: "names", text: "The map labels each county and its capital separately.", supports: true, why: "The two labels distinguish the administrative units." },
      { id: "scope", text: "The schematic does not encode population or reliable distances.", supports: true, why: "A source has limits; use a population table or a scaled map for other claims." },
      { id: "guess", text: "A familiar-looking shape is enough to verify every administrative fact.", supports: false, why: "Visual familiarity is not verification against an authoritative list." }], minSelect: 2 }] },
    { phase: "APPLY", title: "Plan a fair information request", body: "Synthetic task: a school needs to send supplies to a county office. It has a schematic map but no current contact list or travel data.", blocks: [organizer("county-transfer", "Write the county and capital information you can obtain, state its verification limits, and request the additional sources needed to plan delivery.")], prompts: ["Explain why a county's capital label does not establish that a road is passable today."] },
  ];
}

function english(m: string): ScenePlan[] {
  const p = AUTHORING_PLAN.english;
  return [
    { phase: "READ", title: "Read for an evidence-based inference", body: "This original synthetic story is a demonstration, not an account of a real school. Read the actions carefully before deciding what they show about cooperation. Keep the author's words distinct from your interpretation.", blocks: [{ type: "READING_PASSAGE", id: "seed-passage", title: p.title, paragraphs: [...p.paragraphs], glossary: [{ term: "contributed", meaning: "gave something to help a shared effort" }, { term: "harvest", meaning: "the crop gathered when it is ready" }], origin }] },
    { phase: "UNDERSTAND", title: "Check meaning with support", body: "Worked inference: the contribution list includes seeds, work and knowledge. Those different contributions support the claim that help can take several forms. A strong inference joins an exact detail to a reason, rather than treating an opinion as a quotation.", blocks: [check("vocabulary-check", m, "What does contributed mean in this story?", "Gave something to help the shared effort.", "Paid money in every case.", "The story includes seeds, work and knowledge, so contribution is broader than payment."), check("inference-check", m, "Which detail supports several ways to help?", "Some cleaned tins and others taught when to plant.", "The dry season ended.", "The varied actions support the inference; a seasonal detail does not establish it.")] },
    { phase: "ANALYZE", title: "Annotate evidence independently", body: "Select evidence that supports the claim that cooperation includes more than money. Separate relevant details from background information.", blocks: [{ type: "SOURCE_EVIDENCE", id: "seed-annotation", source: { title: p.title, kind: "PASSAGE", origin }, question: "Which details support more than one form of contribution?", sentences: [
      { id: "work", text: "Some families had given seeds, some had cleaned tins, and others had taught the class when to plant.", supports: true, why: "This names materials, work and knowledge." },
      { id: "access", text: "By the next week, every pupil could borrow seeds and promise to return some after the harvest.", supports: true, why: "Shared access shows the result of different contributions." },
      { id: "season", text: "When the dry season ended, Satta found three empty seed tins beside the school garden.", supports: false, why: "This establishes the setting but does not show the range of contributions." }], minSelect: 2 }], prompts: ["Explain how one selected detail supports the claim. State an alternative inference the passage does not establish."] },
    { phase: "CONSTRUCT", title: "Write an independent paragraph", body: "Write a claim, quote an exact detail, and explain how it supports your inference. Do not copy the model explanation. You are writing about this story, not making claims about all Liberian schools.", blocks: [organizer("seed-writing", "Explain how the seed library depends on different contributions.", "seed-passage")] },
    { phase: "REVISE", title: "Revise for precision and evidence", body: "Reread your first paragraph. Check that the quotation occurs in the passage and that your explanation follows from it. Replace an unsupported generalisation with a precise claim, and explain the effect of your change.", blocks: [organizer("seed-revision", "Produce a revised paragraph, then explain one change that improves its reasoning.", "seed-passage")], prompts: ["Give your original sentence, its revision, and the reason the revision is better supported."] },
  ];
}

/** Invoked by the existing factory manager's LESSON_AUTHOR role. */
export function authorLesson(lesson: V4Lesson): CandidateLessonV2 {
  const m = `generated-${lesson.subject.toLowerCase()}-misconception`;
  const plans = lesson.key.includes("area-perimeter") ? geometry(m) : lesson.key.includes("fractions") ? fractions(m) : lesson.key.includes("multiplication") ? multiplication(m) : lesson.subject === "SCIENCE" ? science(m) : lesson.subject === "CIVICS" ? civics(m) : english(m);
  const scenes = plans.map((p, index) => buildScene(p, index, lesson, m));
  const objectiveIds = lesson.objectives.map(o => o.id);
  scenes.push({ id: "generated-assess", type: "MASTERY_CHECK", title: "Independent assessment handoff", purpose: "ASSESS_MASTERY", objectiveIds,
    learnerAction: "Complete the governed assessment independently when an authorized draft form is supplied.",
    content: { body: "Only Assessment Player V2 can collect and score governed assessment responses. This draft has no approved form or official score." },
    interaction: { kind: "ASSESSMENT_HANDOFF", assessmentRequestId: "generated-mastery" }, tools: { requested: [], prohibited: [] }, hints: [], misconceptionIds: [],
    evidence: { kind: "MASTERY_RESPONSE", evidenceType: "QUIZ", responses: objectiveIds.map((objectiveId, i) => ({ responseKey: `assessment-${i}`, objectiveId, responseType: "ASSESSMENT_RESPONSE", scaffoldLevel: "NONE" })) },
    accessibility: { textAlternative: "The lesson requests a separate independent assessment. This draft contains no governed assessment questions or protected scoring material.", keyboardPath: "Use the assessment player's labelled questions and Submit control when an authorized form is available.", reducedMotion: "NOT_APPLICABLE" },
    offline: { mode: "FULL_OFFLINE", note: "No assessment form is cached by this draft. Paper work is capture only and cannot establish an official grade." }, completion: "ALL_ANSWERED", teaching: { phase: "ASSESS", blocks: [] } });
  return parseCandidateLessonV2({ contractVersion: "candidate-lesson-v2/1.1.0", title: `Generated: ${plans[0].title}`, estimatedMinutes: 45,
    ageBand: ageBandForGrade(lesson.grade), instruction: { standard: V4_INSTRUCTION_STANDARD, retention: { delayDays: 7, prompts: [
      `After seven days, independently explain: ${lesson.objectives[0].statement}`.slice(0, 300),
      "Apply the idea to a new context and justify the evidence or calculations used. This is a request for a governed retention task, not a scheduled or scored item." ] } },
    pedagogy: { primaryStrategy: "GUIDED_TO_INDEPENDENT", rationale: "Generate representations and worked reasoning from a versioned subject plan, then fade support before independent work and transfer." },
    prerequisiteAssumptions: ["Can read or access the text equivalent and explain a response in writing or speech."],
    misconceptions: [{ id: m, objectiveId: objectiveIds[0], description: lesson.subject === "MATH" ? "Uses an operation that does not match the representation or its unit." : "Treats an unsupported claim as if it were established by evidence.", response: "Compare the claim with the labelled representation and explain what evidence would support it." }],
    scenes, assessmentRequests: [{ id: "generated-mastery", objectiveIds, interaction: "FREE_RESPONSE", evidenceType: "QUIZ", difficulty: "CORE", misconceptionIds: [m], tools: { requested: [], prohibited: [] }, offline: "FULL_OFFLINE" }], labProposals: [] });
}
