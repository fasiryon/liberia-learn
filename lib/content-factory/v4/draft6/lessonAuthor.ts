import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import type { CandidateLessonV2, CandidateScene } from "@/lib/curriculum/v2/contract";
import type { V4Lesson } from "@/lib/curriculum/v4/candidates";
import { V4_INSTRUCTION_STANDARD, INDEPENDENT_PHASES, type InstructionPhase } from "@/lib/learner-experience/teaching/instruction";
import { blockTextAlternative, type VisualBlock, type BlockOf } from "@/lib/learner-experience/teaching/registry";
import { shapeArea, shapePerimeter } from "@/lib/learner-experience/teaching/models/geometry";
import { fractions, multiplication, science, civics, english } from "./subjects";
import { validateAcademicCandidate, misconceptionDescription } from "./quality";

/** Versioned LESSON_AUTHOR recipe. No reference candidate JSON is read or copied. */
export const LESSON_AUTHOR_VERSION = "factory-v4-lesson-author/1.2.0";
export const AUTHORING_PLAN = Object.freeze({
  geometry: { rectangle: { length: 8, width: 5 }, triangle: { base: 6, height: 4, apexOffset: 3 }, independentRectangle: { length: 11, width: 7 } },
  fractions: { answerRepresentation: "EXACT_RATIONAL", rounding: "ONLY_WHEN_EXPLICIT" },
  multiplication: { factorA: 24, factorB: 13, splitA: [20, 4], splitB: [10, 3] },
  science: { massKg: 1, pressure: "approximately one atmosphere", xAxis: "NET_HEAT_KJ" },
  civics: { map: "PINNED_GEOGRAPHIC_OUTLINES", frontendIntegration: "PENDING" },
  english: { genre: "INFORMATIONAL_EXPLANATION", synthetic: true },
});
const origin = { kind: "ORIGINAL_FOR_LIBERIALEARN" as const, license: "Original synthetic demonstration; internal review only", attribution: "LiberiaLearn Content Factory V4 deterministic author" };
type ScenePlan = { phase: InstructionPhase; title: string; body: string; blocks: VisualBlock[]; action?: string; prompts?: string[] };
const option = (id: string, text: string, feedback: string) => ({ id, text, feedback });

function buildScene(plan: ScenePlan, index: number, lesson: V4Lesson, misconceptionId: string): CandidateScene {
  const id = `generated-${index + 1}`, independent = INDEPENDENT_PHASES.has(plan.phase);
  const worked = plan.phase === "DEMONSTRATE", guided = ["SOLVE_WITH_SUPPORT", "EXPLAIN", "UNDERSTAND", "INVESTIGATE"].includes(plan.phase);
  const geometryActions = ["Compare the inside square-metre grid with the metre boundary; identify the triangle perpendicular height.", "Reveal each area and perimeter step; name the boundary lengths and the square units being counted.", "Calculate both shapes and explain the units in writing.", "Find both measurements of the 11 by 7 rectangle and the triangle with base 10 and height 12; select units independently.", "Diagnose why multiplying 10 by 4 measures covering rather than fencing; account for all four sides.", "Calculate the 12 by 6 floor covering and subtract the doorway only from the skirting boundary."];
  const action = plan.action ?? (lesson.key === "g7-math-area-perimeter" ? geometryActions[index] : undefined) ?? (plan.prompts ? plan.prompts.join(" ").slice(0, 390) : "Use the model, complete its task, and explain what the representation shows.");
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
      formativeKey: { value: p.value, tolerance: 1e-9 }, misconceptions: p.wrong === undefined || p.wrong === p.value ? [] : [{ value: p.wrong, feedback: p.label.includes("Floor") ? "You subtracted a doorway width from a floor area. The floor remains 12 x 6 = 72 square metres; a doorway gap changes only the skirting length." : "You included the 2 m doorway in the skirting boundary. The full perimeter is 36 m; remove 2 m to get 34 m.", misconceptionId }] })),
    hints: mode === "GUIDED" ? ["Name the quantities and represent them before calculating.", "Use the worked model, then check your result with a second representation."] : [],
    afterAttempt: ["Floor covering: 12 x 6 = 72 square metres. The doorway is a boundary gap, not a removed floor patch.", "Skirting: 12 + 6 + 12 + 6 - 2 = 34 metres. Only this boundary length loses the doorway width."],
  };
}

function mistake(id: string, m: string, problem: string, wrong: string, reason: string): BlockOf<"MISTAKE_ANALYSIS"> {
  return { type: "MISTAKE_ANALYSIS", id, problem, attempt: { name: "A learner", steps: [wrong] }, question: "Which diagnosis explains the mistake?",
    options: [option("model", reason, reason), option("keep", "Only two sides need fencing, so add one length and one width.", "A closed plot has four boundary sides. Count the opposite length and width too.")],
    formativeKey: { expectedOptionId: "model" }, correction: [reason, "Rebuild the model and explain a method that agrees with it."], misconceptionId: m };
}

function geometry(m: string): ScenePlan[] {
  const p = AUTHORING_PLAN.geometry;
  const rect = { kind: "RECTANGLE" as const, ...p.rectangle, unit: "m" };
  const tri = { kind: "TRIANGLE" as const, ...p.triangle, unit: "m", sideLabels: [5, 5] as [number, number] };
  const task = (id: string, mode: "GUIDED" | "INDEPENDENT", shape: typeof rect | typeof tri): BlockOf<"NUMERIC_RESPONSE"> => ({
    type: "NUMERIC_RESPONSE", id, mode, prompt: "Find the area and the perimeter. Choose the unit for each measurement.", shape,
    parts: [{ id: `${id}-area`, label: "Area", quantity: "AREA", unit: { kind: "AREA", base: "m" }, formativeKey: { value: shapeArea(shape) }, misconceptions: [{ value: shapePerimeter(shape)!, feedback: "You measured the edge. Area counts squares covering the inside.", misconceptionId: m }, ...(shape.kind === "TRIANGLE" ? [{ value: shape.base * shape.height, feedback: `You entered ${shape.base * shape.height}, the surrounding rectangle area. Halve base ${shape.base} times perpendicular height ${shape.height}.`, misconceptionId: m }, { value: shape.base * shape.sideLabels![0] / 2, feedback: `You used the sloping side ${shape.sideLabels![0]} as height. Area needs the perpendicular height ${shape.height}: halve ${shape.base} times ${shape.height}.`, misconceptionId: m }] : [])] },
      { id: `${id}-edge`, label: "Perimeter", quantity: "PERIMETER", unit: { kind: "LENGTH", base: "m" }, formativeKey: { value: shapePerimeter(shape)! }, misconceptions: [{ value: shapeArea(shape), feedback: "You covered the inside. Perimeter measures every side of the boundary.", misconceptionId: m }, ...(shape.kind === "RECTANGLE" ? [{ value: shape.length + shape.width, feedback: `You counted ${shape.length} plus ${shape.width}, only two sides. Include the opposite pair too.`, misconceptionId: m }] : [{ value: shape.base + shape.height + shape.sideLabels![0], feedback: `You added the inside height ${shape.height} as a boundary. Trace the base ${shape.base} and both sloping sides ${shape.sideLabels!.join(" and ")}.`, misconceptionId: m }])] }],
    hints: mode === "GUIDED" ? ["Trace the edge for perimeter; shade the inside for area.", shape.kind === "TRIANGLE" ? `Use half of ${shape.base} times the perpendicular height ${shape.height} for area. Add the base and the two sloping sides for perimeter; the height lies inside.` : `Count ${shape.width} rows of ${shape.length} square metres. Trace two lengths and two widths for the boundary.`] : [],
    afterAttempt: [`Area = ${shapeArea(shape)} square metres. Perimeter = ${shapePerimeter(shape)} metres.`, "Explain which measurement would buy fencing and which would buy ground covering."],
  });
  return [
    { phase: "VISUALIZE", title: "Covering and fencing", body: "Synthetic school-garden demonstration. Count square metres inside the rectangle and trace metres around its boundary. A triangle with base 6 m and perpendicular height 4 m fills half a 6-by-4 rectangle. Its sloping sides are 5 m each.", blocks: [
      { type: "SHAPE_MODEL", id: "garden-model", shape: rect, views: ["GRID", "AREA", "PERIMETER"], explore: true, caption: "Area covers the inside; perimeter follows the edge." },
      { type: "SHAPE_MODEL", id: "triangle-model", shape: tri, views: ["HEIGHT", "AREA"], explore: false, caption: "Use perpendicular height, not a sloping side." }] },
    { phase: "DEMONSTRATE", title: "Explain both measurements", body: "Watch the method before trying a new garden. Multiplication counts square units. Addition measures the boundary. Even when numerical values happen to match, area and perimeter measure different quantities and require different units.", blocks: [
      { type: "WORKED_SOLUTION", id: "rectangle-worked", problem: "An 8 m by 5 m garden needs mulch and fencing.", shape: rect, steps: [
        { text: "Count 5 rows of 8 unit squares.", tex: `A=8\\times5=${shapeArea(rect)}\\text{ m}^2`, views: ["AREA"] },
        { text: "Add all four sides.", tex: `P=2(8+5)=${shapePerimeter(rect)}\\text{ m}`, views: ["PERIMETER"] }] },
      { type: "WORKED_SOLUTION", id: "triangle-worked", problem: "Find both measurements of the triangular bed.", shape: tri, steps: [
        { text: "Halve the base-by-height rectangle.", tex: `A=\\frac{1}{2}\\times6\\times4=${shapeArea(tri)}\\text{ m}^2`, views: ["HEIGHT", "AREA"] },
        { text: "Add the three boundary lengths, not the height.", tex: `P=6+5+5=${shapePerimeter(tri)}\\text{ m}`, views: ["PERIMETER"] }] }] },
    { phase: "SOLVE_WITH_SUPPORT", title: "Try both shapes with support", body: "For the 9 m by 4 m rectangle, count the inside squares and all four boundary sides. For the new triangle, use base 8 m, perpendicular height 3 m and two sloping sides of 5 m. Write why covering and fencing use different units in the response field.", blocks: [task("guided-rectangle", "GUIDED", { ...rect, length: 9, width: 4 }), task("guided-triangle", "GUIDED", { ...tri, base: 8, height: 3, apexOffset: 4, sideLabels: [5, 5] }), {
        type: "CHECK", id: "units-reason", items: [{ id: "units-reason-item", prompt: "Why do area and perimeter use different units?", misconceptionId: m,
          options: [option("squares", "Area counts unit squares inside; perimeter measures unit lengths around the boundary.", "Yes. A square metre covers a two-dimensional patch; a metre measures a one-dimensional length."), option("size", "Area always has a larger number, so it needs square units.", "The size of the number does not determine the unit. A 2 m by 2 m square has area 4 square metres and perimeter 8 metres."), option("same", "Both measure the same thing, so metres work for both.", "Covering the inside counts squares; tracing an edge counts lengths. They measure different quantities.")], formativeKey: { expectedOptionId: "squares" } }]
      }], prompts: ["Explain why the 9 m by 4 m plot uses square metres for area and metres for perimeter. Describe the square or length that each unit counts."], action: "Calculate covering and fencing for each labelled shape, choose the units explanation, and write why the units differ." },
    { phase: "PRACTICE_INDEPENDENTLY", title: "Measure new plots independently", body: "Solve each problem independently and justify the units. Feedback appears only after an attempt.", blocks: [task("independent-rectangle", "INDEPENDENT", { ...rect, ...p.independentRectangle }), task("independent-triangle", "INDEPENDENT", { ...tri, base: 10, height: 12, apexOffset: 5, sideLabels: [13, 13] })] },
    { phase: "ANALYZE_MISTAKE", title: "Diagnose the garden estimate", body: "Inspect the claim and explain which measurement the method actually produces.", blocks: [mistake("garden-mistake", m, "A 10 m by 4 m plot needs fencing.", "Buy 40 metres of fencing because 10 times 4 is 40.", "Multiplying side lengths finds area; fencing needs the sum of all boundary lengths.")] },
    { phase: "APPLY", title: "Transfer to a floor plan", body: "A synthetic classroom extension has a rectangular floor 12 m by 6 m. A doorway removes 2 m from the skirting board boundary. Determine floor covering and skirting board needed.", blocks: [numeric("floor-transfer", "INDEPENDENT", "Find the quantities for a new job.", [{ label: "Floor covering in square metres", value: 12 * 6, wrong: 70 }, { label: "Skirting board in metres", value: 2 * (12 + 6) - 2, wrong: 36 }], m)], prompts: ["Explain why the doorway changes the skirting length but does not remove a rectangle from the floor covering."] },
  ];
}

/** Invoked by the existing factory manager's LESSON_AUTHOR role. */
export function authorLesson(lesson: V4Lesson): CandidateLessonV2 {
  const m = `generated-${lesson.subject.toLowerCase()}-misconception`;
  const plans = lesson.key.includes("area-perimeter") ? geometry(m) : lesson.key.includes("fractions") ? fractions(m) : lesson.key.includes("multiplication") ? multiplication(m) : lesson.subject === "SCIENCE" ? science(m) : lesson.subject === "CIVICS" ? civics(m) : english(m);
  const scenes = plans.map((p, index) => buildScene(p, index, lesson, m)).map(scene => {
    const signals = (scene.teaching?.blocks ?? []).flatMap(block => block.type === "NUMERIC_RESPONSE" ? block.parts.flatMap(part => part.misconceptions.flatMap(x => x.misconceptionId ? [x.misconceptionId] : [])) : block.type === "CHECK" ? block.items.flatMap(x => x.misconceptionId ? [x.misconceptionId] : []) : []);
    return { ...scene, misconceptionIds: [...new Set([...scene.misconceptionIds, ...signals])] };
  });
  const objectiveIds = lesson.objectives.map(o => o.id);
  scenes.push({ id: "generated-assess", type: "MASTERY_CHECK", title: "Independent assessment handoff", purpose: "ASSESS_MASTERY", objectiveIds,
    learnerAction: "Complete the governed assessment independently when an authorized draft form is supplied.",
    content: { body: "Only Assessment Player V2 can collect and score governed assessment responses. This draft has no approved form or official score." },
    interaction: { kind: "ASSESSMENT_HANDOFF", assessmentRequestId: "generated-mastery" }, tools: { requested: [], prohibited: [] }, hints: [], misconceptionIds: [],
    evidence: { kind: "MASTERY_RESPONSE", evidenceType: "QUIZ", responses: objectiveIds.map((objectiveId, i) => ({ responseKey: `assessment-${i}`, objectiveId, responseType: "ASSESSMENT_RESPONSE", scaffoldLevel: "NONE" })) },
    accessibility: { textAlternative: "The lesson requests a separate independent assessment. This draft contains no governed assessment questions or protected scoring material.", keyboardPath: "Use the assessment player's labelled questions and Submit control when an authorized form is available.", reducedMotion: "NOT_APPLICABLE" },
    offline: { mode: "FULL_OFFLINE", note: "No assessment form is cached by this draft. Paper work is capture only and cannot establish an official grade." }, completion: "ALL_ANSWERED", teaching: { phase: "ASSESS", blocks: [] } });
  const candidate = parseCandidateLessonV2({ contractVersion: "candidate-lesson-v2/1.1.0", title: `Generated: ${plans[0].title}`, estimatedMinutes: 45,
    ageBand: ageBandForGrade(lesson.grade), instruction: { standard: V4_INSTRUCTION_STANDARD, retention: { delayDays: 7, prompts: [
      `After seven days, independently explain: ${lesson.objectives[0].statement}`.slice(0, 300),
      "Apply the idea to a new context and justify the evidence or calculations used. This is a request for a governed retention task, not a scheduled or scored item." ] } },
    pedagogy: { primaryStrategy: "GUIDED_TO_INDEPENDENT", rationale: "Generate representations and worked reasoning from a versioned subject plan, then fade support before independent work and transfer." },
    prerequisiteAssumptions: ["Can read or access the text equivalent and explain a response in writing or speech."],
    misconceptions: [...new Map(scenes.flatMap(scene => (scene.teaching?.blocks ?? []).flatMap(block => block.type === "NUMERIC_RESPONSE" ? block.parts.flatMap(part => part.misconceptions.filter(x => x.misconceptionId).map(x => ({ id: x.misconceptionId!, objectiveId: objectiveIds[0], description: `${part.label}: ${x.feedback}`, response: x.feedback }))) : block.type === "CHECK" ? block.items.filter(x => x.misconceptionId).map(x => ({ id: x.misconceptionId!, objectiveId: objectiveIds[0], description: x.prompt, response: "Compare the quantities and dimensions each unit measures." })) : [])).filter(x => x.id !== m).map(x => [x.id, x])).values(), { id: m, objectiveId: objectiveIds[0], ...misconceptionDescription(lesson.key) }],
    scenes, assessmentRequests: [{ id: "generated-mastery", objectiveIds, interaction: "FREE_RESPONSE", evidenceType: "QUIZ", difficulty: "CORE", misconceptionIds: [m], tools: { requested: [], prohibited: [] }, offline: "FULL_OFFLINE" }], labProposals: [] });
  validateAcademicCandidate(candidate, lesson);
  return candidate;
}
