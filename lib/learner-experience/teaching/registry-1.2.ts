/**
 * Visual Teaching Block Registry `teaching-blocks/1.2.0` (additive). T1 is the canonical editor; the factory consumes it.
 *
 * - 1.1.0 (./registry.ts) stays frozen and byte-identical: its schemas, entries and version literal are imported,
 *   never edited, so sealed packages and sidecars that name 1.1.0 keep validating exactly as before.
 * - 1.2.0 adds the STEM blocks accepted from T2's proposal (stemBlockContracts.ts @ ffc01670c, with the T1/CoS
 *   amendments), widens grade applicability for the blocks K-2 lessons use (Kindergarten is grade 0, CoS
 *   coverage-matrix requiredBlocks), lets MISTAKE_ANALYSIS start at grade 3 under the CoS grade-3 limits, and adds an
 *   optional misconceptionId to CHECK, SORT and MISTAKE_ANALYSIS options so wrong choices can name the misconception
 *   (COS-EARLY-PRIMARY-RULING.md).
 * - Code blocks name their language by the interpreter version (`llcode/1.0.0`); limits are derived from LLCODE_LIMITS
 *   so the schema can never allow more than the interpreter enforces.
 */
import { z } from "zod";
import { BLOCK_SCHEMAS, TEACHING_BLOCK_REGISTRY, TEACHING_BLOCK_REGISTRY_VERSION, blockSemantics, type BlockType, type RegistryEntry, type VisualBlock } from "./registry";
import { subjectFamily_1_1, type SubjectFamily_1_1 } from "./instruction-1.1";
import { LLCODE_LIMITS, LLCODE_VERSION } from "@/lib/learner-experience/stem/llcode";

export const TEACHING_BLOCK_REGISTRY_VERSION_1_2 = "teaching-blocks/1.2.0" as const;
export const TEACHING_BLOCK_REGISTRY_VERSIONS = [TEACHING_BLOCK_REGISTRY_VERSION, TEACHING_BLOCK_REGISTRY_VERSION_1_2] as const;

// ── Shared field shapes (same rules as 1.1.0 and the accepted proposal) ────────────────────────
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const line = z.string().trim().min(1).max(600), text = z.string().trim().min(1).max(2400);
const finite = z.number().finite(), count = z.number().int().nonnegative().max(10000);
const RESERVED = new Set(["constructor", "prototype", "__proto__", "print", "len", "range", "str", "int", "abs", "min", "max", "sum", "input", "if", "elif", "else",
  "while", "for", "in", "def", "return", "break", "continue", "pass", "and", "or", "not", "True", "False", "None"]);
const variable = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/).refine((v) => !RESERVED.has(v), "host_identifier_forbidden");
const move = z.enum(["NORTH", "SOUTH", "EAST", "WEST"]);
const point = z.strictObject({ row: z.number().int().min(0).max(9), column: z.number().int().min(0).max(9) });
const column = z.strictObject({ id, label: line, unit: z.string().max(24), precision: z.number().int().min(0).max(4), minimum: finite, maximum: finite }).refine((c) => c.minimum < c.maximum, "measurement_bounds_invalid");
const literal = z.union([z.number().int().min(-LLCODE_LIMITS.maxInteger).max(LLCODE_LIMITS.maxInteger), z.string().max(512), z.boolean(), z.null()]);
const inputs = z.record(variable, z.union([literal, z.array(literal).max(256)])).refine((v) => Object.keys(v).length <= 16, "too_many_inputs").refine((v) => JSON.stringify(v).length <= 8192, "input_payload_too_large");
const upTo = (max: number, min = 1) => z.number().int().min(min).max(max);
/** Block-level code limits: each maximum IS the interpreter's published limit (tighten-only). */
export const CODE_LIMITS_SCHEMA = z.strictObject({
  sourceChars: upTo(LLCODE_LIMITS.sourceChars), astNodes: upTo(LLCODE_LIMITS.astNodes), steps: upTo(LLCODE_LIMITS.steps), timeoutMs: upTo(LLCODE_LIMITS.timeoutMs, 50),
  callDepth: upTo(LLCODE_LIMITS.callDepth), listLength: upTo(LLCODE_LIMITS.listLength), stringLength: upTo(LLCODE_LIMITS.stringLength), allocatedCells: upTo(LLCODE_LIMITS.allocatedCells),
  outputLines: upTo(LLCODE_LIMITS.outputLines), outputBytes: upTo(LLCODE_LIMITS.outputBytes), traceEntries: upTo(LLCODE_LIMITS.traceEntries),
});

// ── 1.1.0 blocks with the additive misconception link on options ──────────────────────────────
const misconceptionLink = { misconceptionId: id.optional() };
const checkItem = BLOCK_SCHEMAS.CHECK.shape.items.element;
const CHECK_1_2 = BLOCK_SCHEMAS.CHECK.extend({ items: z.array(checkItem.extend({ options: z.array(checkItem.shape.options.element.extend(misconceptionLink)).min(2).max(6) })).min(1).max(6) });
const SORT_1_2 = BLOCK_SCHEMAS.SORT.extend({ cards: z.array(BLOCK_SCHEMAS.SORT.shape.cards.element.extend(misconceptionLink)).min(3).max(16) });
const MISTAKE_ANALYSIS_1_2 = BLOCK_SCHEMAS.MISTAKE_ANALYSIS.extend({ options: z.array(BLOCK_SCHEMAS.MISTAKE_ANALYSIS.shape.options.element.extend(misconceptionLink)).min(2).max(5) });

// ── New STEM blocks (accepted proposal) ──────────────────────────────────────────────────────
function reachable(v: { grid: { rows: number; columns: number }; start: z.infer<typeof point>; goal: z.infer<typeof point>; obstacles: z.infer<typeof point>[]; allowedMoves: z.infer<typeof move>[]; maxSteps: number }) {
  const delta = { NORTH: [-1, 0], SOUTH: [1, 0], EAST: [0, 1], WEST: [0, -1] } as const, key = (p: { row: number; column: number }) => `${p.row}:${p.column}`;
  const blocked = new Set(v.obstacles.map(key)), seen = new Set([key(v.start)]);
  let frontier = [v.start];
  for (let depth = 1; depth <= v.maxSteps && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const at of frontier) for (const m of v.allowedMoves) {
      const p = { row: at.row + delta[m][0], column: at.column + delta[m][1] };
      if (p.row < 0 || p.column < 0 || p.row >= v.grid.rows || p.column >= v.grid.columns || blocked.has(key(p)) || seen.has(key(p))) continue;
      if (key(p) === key(v.goal)) return true;
      seen.add(key(p)); next.push(p);
    }
    frontier = next;
  }
  return false;
}

const STEM_SCHEMAS = {
  AUDIO_PROMPT: z.strictObject({ type: z.literal("AUDIO_PROMPT"), id, text, lang: z.enum(["en", "en-LR"]), fallback: z.literal("TEXT_AND_TEACHER_READ_ALOUD"), autoplay: z.literal(false) }),
  TEN_FRAME_COUNTERS: z.strictObject({ type: z.literal("TEN_FRAME_COUNTERS"), id, frames: upTo(2), target: z.number().int().min(0).max(20), allowFree: z.boolean(), prompt: line })
    .refine((v) => v.target <= v.frames * 10, "target_exceeds_frame_capacity"),
  GRID_ROBOT_PROGRAM: z.strictObject({ type: z.literal("GRID_ROBOT_PROGRAM"), id, prompt: line, grid: z.strictObject({ rows: z.number().int().min(2).max(10), columns: z.number().int().min(2).max(10) }),
    start: point, goal: point, obstacles: z.array(point).max(30), allowedMoves: z.array(move).min(1).max(4), starter: z.array(move).max(40).optional(), maxSteps: upTo(40) }).superRefine((v, c) => {
    const key = (p: { row: number; column: number }) => `${p.row}:${p.column}`;
    if ([v.start, v.goal, ...v.obstacles].some((p) => p.row >= v.grid.rows || p.column >= v.grid.columns)) c.addIssue({ code: "custom", message: "point_outside_grid" });
    if (v.obstacles.some((p) => key(p) === key(v.start) || key(p) === key(v.goal))) c.addIssue({ code: "custom", message: "blocked_start_or_goal" });
    if (new Set(v.obstacles.map(key)).size !== v.obstacles.length || new Set(v.allowedMoves).size !== v.allowedMoves.length) c.addIssue({ code: "custom", message: "duplicate_grid_setting" });
    if (key(v.start) === key(v.goal)) c.addIssue({ code: "custom", message: "start_equals_goal" });
    if ((v.starter ?? []).length > v.maxSteps || (v.starter ?? []).some((m) => !v.allowedMoves.includes(m))) c.addIssue({ code: "custom", message: "invalid_robot_starter" });
    if (!reachable(v)) c.addIssue({ code: "custom", message: "grid_unsolvable" });
  }),
  MEASUREMENT_TABLE: z.strictObject({ type: z.literal("MEASUREMENT_TABLE"), id, title: line, origin: z.enum(["ILLUSTRATIVE", "MEASURED_BY_LEARNER"]), originNote: line, columns: z.array(column).min(1).max(6),
    trials: z.array(z.record(id, finite.nullable())).min(1).max(12), derived: z.array(z.enum(["MEAN", "MINIMUM", "MAXIMUM", "RANGE"])).max(4) }).superRefine((v, c) => {
    if (new Set(v.columns.map((x) => x.id)).size !== v.columns.length) c.addIssue({ code: "custom", message: "duplicate_column" });
    for (const trial of v.trials) for (const [key, value] of Object.entries(trial)) {
      const col = v.columns.find((x) => x.id === key);
      if (!col || (value !== null && (value < col.minimum || value > col.maximum))) c.addIssue({ code: "custom", message: "invalid_measurement_cell" });
      // Learner measurements are never pre-filled: a table cannot fabricate a learner's results.
      if (v.origin === "MEASURED_BY_LEARNER" && value !== null) c.addIssue({ code: "custom", message: "prefilled_learner_measurement_forbidden" });
    }
    if (v.trials.some((row) => v.columns.some((col) => !(col.id in row)))) c.addIssue({ code: "custom", message: "missing_measurement_cell" });
  }),
  GRAPH_BUILDER: z.strictObject({ type: z.literal("GRAPH_BUILDER"), id, prompt: line, sourceBlockId: id, allowedKinds: z.array(z.enum(["BAR", "LINE", "SCATTER"])).min(1).max(3),
    axisRules: z.strictObject({ xColumn: id, yColumn: id, zeroBaselineRequired: z.boolean() }) }),
  DESIGN_CYCLE: z.strictObject({ type: z.literal("DESIGN_CYCLE"), id, brief: text, criteria: z.array(z.strictObject({ id, description: line, measure: line, unit: z.string().max(24), comparison: z.enum(["AT_LEAST", "AT_MOST"]), target: finite })).min(1).max(6),
    constraints: z.array(line).min(1).max(6), safety: z.array(line).min(1).max(6), testPlan: z.array(line).min(2).max(8), maxIterations: z.number().int().min(2).max(5) }),
  BUDGET_CONSTRAINT_TABLE: z.strictObject({ type: z.literal("BUDGET_CONSTRAINT_TABLE"), id, prompt: line, currency: z.literal("LRD"), priceOrigin: z.literal("ILLUSTRATIVE"),
    items: z.array(z.strictObject({ id, name: line, unitCost: count, maxQuantity: upTo(100) })).min(2).max(12), budget: count }).refine((v) => new Set(v.items.map((x) => x.id)).size === v.items.length, "duplicate_budget_item"),
  CODE_TRACE: z.strictObject({ type: z.literal("CODE_TRACE"), id, prompt: line, language: z.literal(LLCODE_VERSION), program: z.string().trim().min(1).max(4000), inputs, watch: z.array(variable).min(1).max(8),
    maxTraceSteps: upTo(100), predictPrompt: line.optional() }),
  CODE_RUNNER: z.strictObject({ type: z.literal("CODE_RUNNER"), id, title: line, prompt: text, language: z.literal(LLCODE_VERSION), starter: z.string().max(LLCODE_LIMITS.sourceChars),
    visibleTests: z.array(z.strictObject({ id, label: line, inputs, expectedStdout: z.string().max(4096) })).min(2).max(8), limits: CODE_LIMITS_SCHEMA })
    .refine((v) => new Set(v.visibleTests.map((t) => t.id)).size === v.visibleTests.length, "duplicate_visible_test_id"),
  OBSERVATION_LOG: z.strictObject({ type: z.literal("OBSERVATION_LOG"), id, prompt: line, origin: z.literal("MEASURED_BY_LEARNER"), fields: z.array(z.strictObject({ id, label: line })).min(2).max(5),
    maxEntries: upTo(8), responseModes: z.array(z.enum(["ORAL_WITH_SCRIBE", "TEXT", "DRAWING"])).min(1).max(3) }),
  PHONICS_BLENDER: z.strictObject({ type: z.literal("PHONICS_BLENDER"), id, prompt: line, words: z.array(z.strictObject({ word: z.string().regex(/^[a-z]{2,12}$/), graphemes: z.array(z.string().regex(/^[a-z]{1,3}$/)).min(2).max(6) })).min(3).max(8),
    audioFallback: z.literal("TEACHER_READ_ALOUD") }).refine((v) => v.words.every((w) => w.graphemes.join("") === w.word), "phonics_word_mismatch"),
} as const;

export const BLOCK_SCHEMAS_1_2 = Object.freeze({ ...BLOCK_SCHEMAS, CHECK: CHECK_1_2, SORT: SORT_1_2, MISTAKE_ANALYSIS: MISTAKE_ANALYSIS_1_2, ...STEM_SCHEMAS });
export type BlockType_1_2 = keyof typeof BLOCK_SCHEMAS_1_2;
export type StemBlockType = keyof typeof STEM_SCHEMAS;
export type VisualBlock_1_2 = { [K in BlockType_1_2]: z.infer<(typeof BLOCK_SCHEMAS_1_2)[K]> }[BlockType_1_2];

// ── Registry entries ─────────────────────────────────────────────────────────────────────────
export type RegistryEntry_1_2 = Readonly<Omit<RegistryEntry, "type" | "since" | "subjects" | "seconds"> & {
  type: BlockType_1_2; since: RegistryEntry["since"] | typeof TEACHING_BLOCK_REGISTRY_VERSION_1_2;
  subjects: readonly SubjectFamily_1_1[] | "ANY"; seconds: (block: VisualBlock_1_2) => number;
}>;
/** 1.2.0 grade applicability changes for existing blocks (Kindergarten = 0). Everything else keeps its 1.1.0 range. */
export const GRADE_CHANGES_1_2: Readonly<Partial<Record<BlockType, readonly [number, number]>>> = Object.freeze({
  CHECK: [0, 12], SORT: [0, 12], SEQUENCE: [0, 12], SENTENCE_BUILDER: [0, 12], ARRAY_MODEL: [0, 7], SHAPE_MODEL: [0, 10], PROCESS_CYCLE: [0, 12], MAP_EXPLORER: [0, 12],
  MISTAKE_ANALYSIS: [3, 12],
});
const stem = (type: StemBlockType, value: Omit<RegistryEntry_1_2, "type" | "since" | "assessment" | "offline">): RegistryEntry_1_2 =>
  Object.freeze({ type, since: TEACHING_BLOCK_REGISTRY_VERSION_1_2, assessment: "FORMATIVE_ONLY", offline: "FULL", ...value });
const as = <K extends BlockType_1_2>(block: VisualBlock_1_2) => block as Extract<VisualBlock_1_2, { type: K }>;

export const TEACHING_BLOCK_REGISTRY_1_2: Readonly<Record<BlockType_1_2, RegistryEntry_1_2>> = Object.freeze({
  ...Object.fromEntries(Object.entries(TEACHING_BLOCK_REGISTRY).map(([type, e]) => [type, Object.freeze({ ...e, grades: GRADE_CHANGES_1_2[type as BlockType] ?? e.grades, seconds: (b: VisualBlock_1_2) => e.seconds(b as VisualBlock) })])) as Record<BlockType, RegistryEntry_1_2>,
  AUDIO_PROMPT: stem("AUDIO_PROMPT", { label: "Listen", purpose: "Hear an instruction read aloud on the device, with the same words on screen and a teacher read-aloud fallback.", subjects: "ANY", grades: [0, 2], interactive: true, engagement: "EXPLANATION", feedback: "NONE", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 260, seconds: () => 20 }),
  TEN_FRAME_COUNTERS: stem("TEN_FRAME_COUNTERS", { label: "Ten-frame counters", purpose: "Place counters in ten-frames to show and count a number.", subjects: ["MATHEMATICS"], grades: [0, 2], interactive: true, engagement: "EXPLORATION", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 280, seconds: () => 60 }),
  GRID_ROBOT_PROGRAM: stem("GRID_ROBOT_PROGRAM", { label: "Program the robot", purpose: "Build a sequence of moves for a grid robot, run it step by step and fix the move that fails.", subjects: ["COMPUTING", "MATHEMATICS"], grades: [0, 5], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: (b) => 30 + 10 * as<"GRID_ROBOT_PROGRAM">(b).maxSteps }),
  MEASUREMENT_TABLE: stem("MEASUREMENT_TABLE", { label: "Measurement table", purpose: "Record repeated trials with units; the origin (measured or illustrative) is always stated.", subjects: ["SCIENCE", "MATHEMATICS", "ENGINEERING"], grades: [3, 12], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: (b) => 20 * as<"MEASUREMENT_TABLE">(b).trials.length }),
  GRAPH_BUILDER: stem("GRAPH_BUILDER", { label: "Graph builder", purpose: "Plot a measurement table as a graph, choosing the kind of graph and the axes.", subjects: ["SCIENCE", "MATHEMATICS", "ENGINEERING", "HUMANITIES"], grades: [3, 12], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: () => 120 }),
  DESIGN_CYCLE: stem("DESIGN_CYCLE", { label: "Design cycle", purpose: "Define a problem, test a design against criteria and constraints, and improve it across iterations.", subjects: ["ENGINEERING", "SCIENCE"], grades: [0, 12], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: (b) => 300 * as<"DESIGN_CYCLE">(b).maxIterations }),
  BUDGET_CONSTRAINT_TABLE: stem("BUDGET_CONSTRAINT_TABLE", { label: "Budget table", purpose: "Choose materials and quantities within a budget, with illustrative prices.", subjects: ["ENGINEERING", "MATHEMATICS"], grades: [6, 12], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: () => 120 }),
  CODE_TRACE: stem("CODE_TRACE", { label: "Trace the program", purpose: "Predict a program's output, then step through it line by line with its variables.", subjects: ["COMPUTING"], grades: [6, 12], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: (b) => 60 + 10 * as<"CODE_TRACE">(b).maxTraceSteps }),
  CODE_RUNNER: stem("CODE_RUNNER", { label: "Write and test code", purpose: "Edit a program in the restricted teaching language and run its visible tests on the device.", subjects: ["COMPUTING"], grades: [6, 12], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "FORMATIVE_LOCAL", provenance: "NOT_APPLICABLE", minInlineSize: 300, seconds: () => 600 }),
  OBSERVATION_LOG: stem("OBSERVATION_LOG", { label: "Observation log", purpose: "Record what was seen in a hands-on investigation by speaking, writing or drawing.", subjects: ["SCIENCE", "ENGINEERING"], grades: [0, 2], interactive: true, engagement: "PRACTICE", feedback: "NONE", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 280, seconds: (b) => 60 * as<"OBSERVATION_LOG">(b).maxEntries }),
  PHONICS_BLENDER: stem("PHONICS_BLENDER", { label: "Blend the sounds", purpose: "Join letter sounds into a word, with a teacher read-aloud fallback.", subjects: ["LANGUAGE"], grades: [0, 2], interactive: true, engagement: "PRACTICE", feedback: "DERIVED_FROM_MODEL", keyPolicy: "NONE", provenance: "NOT_APPLICABLE", minInlineSize: 280, seconds: (b) => 20 * as<"PHONICS_BLENDER">(b).words.length }),
});

/** The registry a package must be validated against, by the version it was sealed under. */
export function registryFor(version: string) {
  if (version === TEACHING_BLOCK_REGISTRY_VERSION) return { version, schemas: BLOCK_SCHEMAS as Readonly<Record<string, z.ZodType>>, entries: TEACHING_BLOCK_REGISTRY as Readonly<Record<string, Pick<RegistryEntry, "subjects" | "grades">>> };
  if (version === TEACHING_BLOCK_REGISTRY_VERSION_1_2) return { version, schemas: BLOCK_SCHEMAS_1_2 as Readonly<Record<string, z.ZodType>>, entries: TEACHING_BLOCK_REGISTRY_1_2 as Readonly<Record<string, Pick<RegistryEntry_1_2, "subjects" | "grades">>> };
  throw Error(`teaching_block_registry_unknown:${version}`);
}

// ── Validation ───────────────────────────────────────────────────────────────────────────────
/** CoS 3-5 reading limit (standards.cjs DEVELOPMENTAL["3-5"].maxSentenceWords). */
const GRADE_3_MAX_SENTENCE_WORDS = 16;
const longestSentence = (value: string) => Math.max(0, ...value.split(/(?<=[.!?])\s+/).map((s) => s.split(/\s+/).filter(Boolean).length));

/** Grade-3 MISTAKE_ANALYSIS limits (COS-EARLY-PRIMARY-RULING §1). Returns problem codes. */
export function grade3MistakeProblems(block: z.infer<typeof MISTAKE_ANALYSIS_1_2>): string[] {
  const problems: string[] = [];
  if (block.attempt.steps.length > 3) problems.push("mistake_g3_attempt_steps");
  if (block.options.length > 3) problems.push("mistake_g3_options");
  if (block.correction.length > 3) problems.push("mistake_g3_correction_lines");
  if (block.options.some((o) => o.id !== block.formativeKey.expectedOptionId && !o.misconceptionId)) problems.push("mistake_g3_unlinked_wrong_option");
  const texts = [block.problem, block.question, ...block.attempt.steps, ...block.correction, ...block.options.flatMap((o) => [o.text, o.feedback])];
  if (texts.some((t) => longestSentence(t) > GRADE_3_MAX_SENTENCE_WORDS)) problems.push("mistake_g3_sentence_length");
  return problems;
}

export type BlockContext_1_2 = Readonly<{ subject: string; grade: number }>;
/** Strict 1.2.0 parse plus semantics and subject/grade fit. `problems` empty means the block may be rendered. */
export function validateBlock_1_2(input: unknown, context?: BlockContext_1_2): { block: VisualBlock_1_2 | null; problems: string[] } {
  const type = typeof input === "object" && input !== null && "type" in input ? String((input as { type: unknown }).type) : "";
  if (!(type in BLOCK_SCHEMAS_1_2)) return { block: null, problems: [`block_type_unsupported:${type || "missing"}`] };
  const parsed = (BLOCK_SCHEMAS_1_2[type as BlockType_1_2] as z.ZodType).safeParse(input);
  if (!parsed.success) return { block: null, problems: parsed.error.issues.slice(0, 5).map((issue) => `block_schema:${type}:${issue.path.join(".") || "$"}:${issue.message}`) };
  const block = parsed.data as VisualBlock_1_2;
  const problems = type in BLOCK_SCHEMAS ? blockSemantics(block as VisualBlock) : [];
  if (context) {
    const registered = TEACHING_BLOCK_REGISTRY_1_2[block.type], family = subjectFamily_1_1(context.subject);
    if (registered.subjects !== "ANY" && (!family || !registered.subjects.includes(family))) problems.push(`block_subject_unfit:${block.type}:${context.subject}`);
    if (context.grade < registered.grades[0] || context.grade > registered.grades[1]) problems.push(`block_grade_unfit:${block.type}:${context.grade}`);
    if (block.type === "MISTAKE_ANALYSIS" && context.grade === 3) problems.push(...grade3MistakeProblems(block as z.infer<typeof MISTAKE_ANALYSIS_1_2>));
  }
  return { block, problems };
}

/** Same-package references: GRAPH_BUILDER must point at a MEASUREMENT_TABLE and its columns. */
export function validateBlockReferences_1_2(blocks: readonly VisualBlock_1_2[]): string[] {
  const problems: string[] = [];
  const ids = blocks.map((b) => ("id" in b ? b.id : null)).filter(Boolean);
  if (new Set(ids).size !== ids.length) problems.push("duplicate_block_id");
  for (const block of blocks) if (block.type === "GRAPH_BUILDER") {
    const source = blocks.find((b) => "id" in b && b.id === block.sourceBlockId);
    if (source?.type !== "MEASUREMENT_TABLE" || ![block.axisRules.xColumn, block.axisRules.yColumn].every((c) => source.columns.some((col) => col.id === c))) problems.push(`graph_reference_invalid:${block.id}`);
  }
  return problems;
}

/**
 * The mathematics "mistakes" requirement under instruction 1.1.0 (COS-EARLY-PRIMARY-RULING §1).
 * Grades 3-12: a MISTAKE_ANALYSIS. K-2: an oral "spot the mistake", an AUDIO_PROMPT plus a CHECK whose wrong options
 * each name a misconception, or a SORT whose cards each name one. No written correction is required in K-2.
 */
export function mistakeRequirement(blocks: readonly VisualBlock_1_2[], grade: number): { met: boolean; form: "MISTAKE_ANALYSIS" | "ORAL_SPOT_THE_MISTAKE"; misconceptions: string[] } {
  const named = new Set<string>();
  if (grade >= 3) {
    const found = blocks.filter((b): b is Extract<VisualBlock_1_2, { type: "MISTAKE_ANALYSIS" }> => b.type === "MISTAKE_ANALYSIS");
    for (const b of found) { if (b.misconceptionId) named.add(b.misconceptionId); for (const o of b.options) if (o.misconceptionId) named.add(o.misconceptionId); }
    return { met: found.length > 0, form: "MISTAKE_ANALYSIS", misconceptions: [...named] };
  }
  const audio = blocks.some((b) => b.type === "AUDIO_PROMPT");
  const checkOk = blocks.some((b) => b.type === "CHECK" && b.items.every((item) => item.options.every((o) => o.id === item.formativeKey.expectedOptionId || (o.misconceptionId && named.add(o.misconceptionId)))));
  const sortOk = blocks.some((b) => b.type === "SORT" && b.cards.every((card) => card.misconceptionId && named.add(card.misconceptionId)));
  return { met: audio && (checkOk || sortOk), form: "ORAL_SPOT_THE_MISTAKE", misconceptions: [...named] };
}

/** Blocks a generator may use for a subject and grade under 1.2.0. */
export function blocksFor_1_2(context: BlockContext_1_2): readonly BlockType_1_2[] {
  const family = subjectFamily_1_1(context.subject);
  return (Object.keys(TEACHING_BLOCK_REGISTRY_1_2) as BlockType_1_2[]).filter((type) => {
    const e = TEACHING_BLOCK_REGISTRY_1_2[type];
    return context.grade >= e.grades[0] && context.grade <= e.grades[1] && (e.subjects === "ANY" || (family !== null && e.subjects.includes(family)));
  });
}
