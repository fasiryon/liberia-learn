/**
 * Interactive Learning V4 — the instructional standard every Curriculum V2 `candidate-lesson-v2/1.1.0` lesson
 * is checked against before review (`liberialearn-v4-instruction/1.0.0`).
 *
 * The founder's rule, made checkable: a lesson never depends on long paragraphs when a diagram, demonstration,
 * simulation, worked example or learner activity would teach the concept better. Concretely:
 *
 *   pattern       the scenes move through the subject family's teaching pattern (math: visualize → demonstrate →
 *                 solve with support → practise independently → analyse a mistake → apply; science: predict →
 *                 experiment → observe → explain → apply; humanities: explore → investigate → compare → reason →
 *                 apply; language: read → understand → analyse → construct → revise)
 *   brevity       explanation lives in short paragraphs; sustained reading belongs in a READING_PASSAGE or
 *                 SOURCE_EVIDENCE block, where the learner works with the text
 *   balance       roughly 25–35% of estimated learner time is instruction (explanation, worked examples, exploring a
 *                 model or reading), 65–75% is activity (solving, deciding, producing)
 *   practice      mathematics concepts get a visual, a worked example, two guided and two independent problems,
 *                 a mistake to diagnose and a transfer problem; other families get a comparable minimum
 *   independence  independent phases carry no worked steps, guided hints or scene hints; mastery is only ever
 *                 the ASSESSMENT_HANDOFF to Assessment Player V2, with no teaching blocks and no formative keys
 *   misconceptions every declared misconception is taught against and diagnosable by a block
 *   retention     delayed retrieval (≥ 7 days) is requested from the Content Factory RETENTION resource
 *
 * ERROR problems reject a generated candidate (the factory retries with the codes as feedback); BLOCKING
 * problems keep it out of student delivery until revised; ADVISORY ones are for the human reviewer. Static
 * checks catch structural failure. They cannot prove a lesson teaches well: that stays with human review and
 * the pilot measurement plan.
 */
import type { CandidateLessonV2, CandidateScene } from "@/lib/curriculum/v2/contract";
import { INDEPENDENT_PHASES, INSTRUCTION_PATTERNS, SHARED_PHASES, V4_INSTRUCTION_STANDARD, isSupportBlock, type InstructionPhase } from "@/lib/learner-experience/teaching/instruction";
import { TEACHING_BLOCK_REGISTRY, subjectFamily, type SubjectFamily, type VisualBlock } from "@/lib/learner-experience/teaching/registry";

export type StandardSeverity = "ERROR" | "BLOCKING" | "ADVISORY";
export type StandardProblem = Readonly<{ code: string; severity: StandardSeverity; detail: string; sceneId?: string }>;

export type PracticeCounts = Readonly<{ visuals: number; workedExamples: number; guided: number; independent: number; mistakes: number; transfer: number }>;

export type StandardReport = Readonly<{
  standard: typeof V4_INSTRUCTION_STANDARD;
  family: SubjectFamily | null;
  pattern: readonly string[];
  phases: readonly Readonly<{ sceneId: string; phase: InstructionPhase | null }>[];
  balance: Readonly<{ explanationSeconds: number; activitySeconds: number; activityShare: number }>;
  practice: Readonly<Record<string, PracticeCounts>>;
  totals: PracticeCounts & Readonly<{ problems: number }>;
  problems: readonly StandardProblem[];
}>;

export const V4_LIMITS = Object.freeze({ paragraphWordsAdvisory: 60, paragraphWordsBlocking: 100, sceneBodyWordsBlocking: 150, activityShareMin: 0.6, activityShareTargetMin: 0.65, activityShareTargetMax: 0.75, activityShareMax: 0.85, retentionDelayDays: 7 });

export const MATH_PRACTICE_TARGET: PracticeCounts = Object.freeze({ visuals: 1, workedExamples: 1, guided: 2, independent: 2, mistakes: 1, transfer: 1 });

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const blocksOf = (scene: CandidateScene): readonly VisualBlock[] => (scene.teaching ? [...scene.teaching.blocks, ...(scene.teaching.visual ? [scene.teaching.visual] : [])] : []);

/** Answerable units in a block (a two-part numeric problem is two problems; exploring is none). */
export function problemCount(block: VisualBlock): number {
  switch (block.type) {
    case "NUMERIC_RESPONSE": return block.parts.length;
    case "CHECK": return block.items.length;
    case "AREA_MODEL": return block.mode === "FILL" ? (block.splitA?.length ?? 2) * (block.splitB?.length ?? 1) : 0;
    case "FRACTION_MODEL": return block.interaction === "SHADE_TARGET" ? 1 : 0;
    case "MAP_EXPLORER": return block.task ? 1 : 0;
    case "FRACTION_COMPARE": case "FRACTION_NUMBER_LINE": case "MISTAKE_ANALYSIS": case "PREDICT_OBSERVE": case "SOURCE_EVIDENCE": case "SENTENCE_BUILDER":
    case "WRITING_ORGANIZER": case "SORT": case "SEQUENCE": case "DIGIT_CARDS": return 1;
    default: return 0;
  }
}

function interactionProblems(scene: CandidateScene): number {
  if (scene.interaction.kind === "SINGLE_CHOICE") return scene.interaction.items.length;
  if (scene.interaction.kind === "FREE_RESPONSE") return scene.interaction.prompts.length;
  return 0;
}

function interactionSeconds(scene: CandidateScene): number {
  switch (scene.interaction.kind) {
    case "SINGLE_CHOICE": return 40 * scene.interaction.items.length;
    case "FREE_RESPONSE": return 120 * scene.interaction.prompts.length;
    case "DIAGRAM_REVEAL": return 15 * scene.interaction.steps.length;
    case "LAB_LAUNCH": return 300;
    default: return 0;
  }
}

const VISUAL_TYPES = new Set<VisualBlock["type"]>(["SHAPE_MODEL", "FRACTION_MODEL", "FRACTION_EQUIVALENCE", "FRACTION_NUMBER_LINE", "FRACTION_COMPARE", "ARRAY_MODEL", "AREA_MODEL", "PARTICLE_MODEL", "DATA_PLOT", "MAP_EXPLORER", "PLACE_VALUE_CHART", "GROUPED_NUMBER", "PROCESS_CYCLE", "WORKED_SOLUTION", "EQUATION"]);

export function evaluateV4Standard(candidate: CandidateLessonV2, context: Readonly<{ subject: string; grade: number }>): StandardReport {
  const problems: StandardProblem[] = [];
  const add = (code: string, severity: StandardSeverity, detail: string, sceneId?: string) => problems.push({ code, severity, detail, ...(sceneId ? { sceneId } : {}) });
  const family = subjectFamily(context.subject);
  const pattern: readonly string[] = family ? INSTRUCTION_PATTERNS[family] : [];
  const allowed = new Set<string>([...pattern, ...SHARED_PHASES]);
  if (!family) add("v4_subject_family_unknown", "BLOCKING", `No V4 teaching pattern for subject ${context.subject}; choose blocks by objective and record the rationale for review.`);
  if (!candidate.instruction || candidate.instruction.standard !== V4_INSTRUCTION_STANDARD) add("v4_instruction_plan_missing", "ERROR", "A 1.1.0 candidate declares instruction.standard liberialearn-v4-instruction/1.0.0.");

  const misconceptionIds = new Set(candidate.misconceptions.map((misconception) => misconception.id));
  const taughtAgainst = new Set<string>();
  const diagnosable = new Set<string>();
  const practice: Record<string, { visuals: number; workedExamples: number; guided: number; independent: number; mistakes: number; transfer: number }> = {};
  const counts = (objectiveId: string) => (practice[objectiveId] ??= { visuals: 0, workedExamples: 0, guided: 0, independent: 0, mistakes: 0, transfer: 0 });
  let explanationSeconds = 0, activitySeconds = 0, totalProblems = 0;
  const phases: { sceneId: string; phase: InstructionPhase | null }[] = [];

  for (const scene of candidate.scenes) {
    const phase = scene.teaching?.phase ?? null;
    phases.push({ sceneId: scene.id, phase });
    const blocks = blocksOf(scene);
    for (const id of scene.misconceptionIds) taughtAgainst.add(id);
    if (scene.evidence.kind !== "NONE") for (const response of scene.evidence.responses) if (response.misconceptionId) diagnosable.add(response.misconceptionId);

    if (!phase) { add("v4_scene_phase_missing", "ERROR", "Every scene of a V4 lesson names its instructional phase.", scene.id); continue; }
    if (!allowed.has(phase)) add("v4_phase_not_in_pattern", "ERROR", `${phase} is not part of the ${family ?? "unknown"} pattern.`, scene.id);

    // Mastery is the assessment authority's: no teaching blocks, no formative keys, only the handoff.
    if (phase === "ASSESS" || scene.type === "MASTERY_CHECK") {
      if (blocks.length) add("v4_blocks_in_mastery", "ERROR", "Mastery scenes carry no teaching blocks or formative keys.", scene.id);
      if (scene.type !== "MASTERY_CHECK" || scene.interaction.kind !== "ASSESSMENT_HANDOFF") add("v4_assess_requires_handoff", "ERROR", "The ASSESS phase is a MASTERY_CHECK scene with an ASSESSMENT_HANDOFF.", scene.id);
      continue;
    }
    if (INDEPENDENT_PHASES.has(phase)) {
      if (blocks.some(isSupportBlock)) add("v4_support_in_independent_phase", "ERROR", "Worked steps or guided hints would give an independent task away.", scene.id);
      if (scene.hints.length) add("v4_hints_in_independent_phase", "ERROR", "Independent scenes offer no hints before an attempt.", scene.id);
    }
    if (blocks.length === 0 && phase !== "ORIENT" && phase !== "RETRIEVE" && scene.interaction.kind === "NONE") add("v4_text_only_scene", "BLOCKING", "A teaching scene with no diagram, model, worked example or learner activity.", scene.id);

    // Brevity: explanation in short paragraphs; long reading belongs in a passage the learner works with.
    const paragraphs = scene.content.body.split(/\n{2,}/);
    const longest = Math.max(0, ...paragraphs.map(words));
    if (words(scene.content.body) > V4_LIMITS.sceneBodyWordsBlocking) add("v4_scene_body_too_long", "BLOCKING", `${words(scene.content.body)} words of explanation; move reading into a READING_PASSAGE or show it with a block.`, scene.id);
    if (longest > V4_LIMITS.paragraphWordsBlocking) add("v4_paragraph_too_long", "BLOCKING", `A ${longest}-word paragraph.`, scene.id);
    else if (longest > V4_LIMITS.paragraphWordsAdvisory) add("v4_paragraph_long", "ADVISORY", `A ${longest}-word paragraph; consider splitting it or showing it.`, scene.id);

    explanationSeconds += Math.round(((words(scene.content.body) + words((scene.content.keyPoints ?? []).join(" "))) / 150) * 60);
    activitySeconds += interactionSeconds(scene);
    const sceneProblems = blocks.reduce((sum, block) => sum + problemCount(block), 0) + interactionProblems(scene);
    totalProblems += sceneProblems;

    for (const block of blocks) {
      const registered = TEACHING_BLOCK_REGISTRY[block.type];
      const seconds = registered.seconds(block);
      // Watching, reading and exploring a model are instruction; solving, deciding and producing are activity.
      if (registered.engagement === "PRACTICE") activitySeconds += seconds; else explanationSeconds += seconds;
      // Misconceptions named by blocks must be declared; naming one makes it taught against and diagnosable.
      const named: string[] = [];
      if (block.type === "MISTAKE_ANALYSIS" && block.misconceptionId) { named.push(block.misconceptionId); taughtAgainst.add(block.misconceptionId); }
      if (block.type === "CHECK") for (const item of block.items) if (item.misconceptionId) named.push(item.misconceptionId);
      if (block.type === "SORT" && block.misconceptionId) named.push(block.misconceptionId);
      if (block.type === "NUMERIC_RESPONSE") for (const part of block.parts) for (const entry of part.misconceptions) if (entry.misconceptionId) named.push(entry.misconceptionId);
      for (const id of named) { if (!misconceptionIds.has(id)) add("v4_block_misconception_unknown", "ERROR", `${id} is not a declared misconception.`, scene.id); diagnosable.add(id); }
    }

    for (const objectiveId of scene.objectiveIds) {
      const tally = counts(objectiveId);
      if (phase === "VISUALIZE" || phase === "EXPLORE" || phase === "EXPERIMENT" || phase === "OBSERVE" || phase === "READ") tally.visuals += blocks.filter((block) => VISUAL_TYPES.has(block.type) || block.type === "READING_PASSAGE" || block.type === "SOURCE_EVIDENCE" || block.type === "PREDICT_OBSERVE").length;
      tally.workedExamples += blocks.filter((block) => block.type === "WORKED_SOLUTION" || block.type === "STEP_REVEAL").length;
      if (phase === "SOLVE_WITH_SUPPORT" || phase === "UNDERSTAND" || phase === "INVESTIGATE" || phase === "EXPLAIN") tally.guided += sceneProblems;
      if (phase === "PRACTICE_INDEPENDENTLY" || phase === "ANALYZE" || phase === "COMPARE" || phase === "OBSERVE") tally.independent += blocks.filter((block) => block.type !== "MISTAKE_ANALYSIS").reduce((sum, block) => sum + problemCount(block), 0) + interactionProblems(scene);
      tally.mistakes += blocks.filter((block) => block.type === "MISTAKE_ANALYSIS").length;
      if (phase === "APPLY" || phase === "REASON" || phase === "CONSTRUCT" || phase === "REVISE") tally.transfer += sceneProblems;
    }
  }

  // Pattern: every phase of the family appears, first occurrences in order (cycles for further concepts are fine).
  const firstAt = new Map<string, number>();
  phases.forEach((entry, index) => { if (entry.phase && !firstAt.has(entry.phase)) firstAt.set(entry.phase, index); });
  for (const phase of pattern) if (!firstAt.has(phase)) add("v4_pattern_phase_missing", "BLOCKING", `The ${family} pattern needs a ${phase} scene.`);
  const ordered = pattern.filter((phase) => firstAt.has(phase)).map((phase) => firstAt.get(phase)!);
  if (ordered.some((position, index) => index > 0 && position < ordered[index - 1])) add("v4_pattern_order", "ADVISORY", "The pattern's phases first appear out of order; confirm the sequence is deliberate.");

  // Assessment: the lesson hands mastery to Assessment Player V2.
  if (!candidate.scenes.some((scene) => scene.interaction.kind === "ASSESSMENT_HANDOFF")) add("v4_no_assessment_handoff", "BLOCKING", "No ASSESSMENT_HANDOFF: independent evidence of learning is missing.");

  // Misconceptions: taught against and diagnosable.
  for (const misconception of candidate.misconceptions) {
    if (!taughtAgainst.has(misconception.id)) add("v4_misconception_not_taught", "BLOCKING", `${misconception.id} is never taught against (scene misconceptionIds or a MISTAKE_ANALYSIS block).`);
    if (!diagnosable.has(misconception.id)) add("v4_misconception_not_diagnosable", "BLOCKING", `${misconception.id} has no block or response that would reveal it.`);
  }

  // Retention.
  const retention = candidate.instruction?.retention;
  if (candidate.instruction && (!retention || retention.delayDays < V4_LIMITS.retentionDelayDays || retention.prompts.length < 2)) add("v4_retention_insufficient", "BLOCKING", "Request delayed retrieval at least 7 days later with at least two prompts.");

  // Balance.
  const total = explanationSeconds + activitySeconds;
  const activityShare = total ? activitySeconds / total : 0;
  if (activityShare < V4_LIMITS.activityShareMin) add("v4_activity_share_low", "BLOCKING", `Only ${Math.round(activityShare * 100)}% of learner time is activity (target 65–75%).`);
  else if (activityShare < V4_LIMITS.activityShareTargetMin || activityShare > V4_LIMITS.activityShareTargetMax) add("v4_activity_share_outside_target", "ADVISORY", `${Math.round(activityShare * 100)}% activity (target 65–75%); do not pad with repetitive questions to reach it.`);
  if (activityShare > V4_LIMITS.activityShareMax) add("v4_explanation_too_thin", "ADVISORY", "Very little explanation; confirm learners are taught before they practise.");

  // Practice density.
  const totals = Object.values(practice).reduce((sum, tally) => ({ visuals: sum.visuals + tally.visuals, workedExamples: sum.workedExamples + tally.workedExamples, guided: sum.guided + tally.guided, independent: sum.independent + tally.independent, mistakes: sum.mistakes + tally.mistakes, transfer: sum.transfer + tally.transfer }), { visuals: 0, workedExamples: 0, guided: 0, independent: 0, mistakes: 0, transfer: 0 });
  if (family === "MATHEMATICS") {
    // Per concept: every objective that is demonstrated gets the full rhythm.
    const demonstrated = new Set(candidate.scenes.filter((scene) => scene.teaching?.phase === "DEMONSTRATE").flatMap((scene) => scene.objectiveIds));
    for (const objectiveId of demonstrated) {
      const tally = counts(objectiveId);
      for (const key of Object.keys(MATH_PRACTICE_TARGET) as (keyof PracticeCounts)[]) if (tally[key] < MATH_PRACTICE_TARGET[key]) add("v4_math_practice_short", "BLOCKING", `${objectiveId}: ${key} ${tally[key]} of ${MATH_PRACTICE_TARGET[key]}.`);
    }
    if (demonstrated.size === 0) add("v4_math_no_demonstration", "BLOCKING", "No DEMONSTRATE scene: mathematics needs a worked solution.");
  } else if (family) {
    if (totals.guided < 2) add("v4_guided_practice_short", "BLOCKING", `Guided work ${totals.guided} (at least 2).`);
    if (totals.independent < 2) add("v4_independent_practice_short", "BLOCKING", `Independent work ${totals.independent} (at least 2).`);
    if (totals.transfer < 1) add("v4_transfer_missing", "BLOCKING", "No application or construction task in a new context.");
  }

  return { standard: V4_INSTRUCTION_STANDARD, family, pattern, phases, balance: { explanationSeconds, activitySeconds, activityShare: Math.round(activityShare * 1000) / 1000 }, practice, totals: { ...totals, problems: totalProblems }, problems };
}
