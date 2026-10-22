/**
 * Interactive Learning V4 — instructional phases (`liberialearn-v4-instruction/1.0.0`).
 *
 * Each subject family has an adaptable teaching pattern, not a rigid template. A scene names the phase it
 * serves; the standard (lib/curriculum/v4/standard.ts) checks that a lesson moves through its family's
 * pattern, keeps explanation short, gives learners enough to do, and keeps independent work independent.
 */
import type { SubjectFamily, VisualBlock } from "./registry";

export const V4_INSTRUCTION_STANDARD = "liberialearn-v4-instruction/1.0.0" as const;

export const INSTRUCTION_PATTERNS = {
  MATHEMATICS: ["VISUALIZE", "DEMONSTRATE", "SOLVE_WITH_SUPPORT", "PRACTICE_INDEPENDENTLY", "ANALYZE_MISTAKE", "APPLY"],
  SCIENCE: ["PREDICT", "EXPERIMENT", "OBSERVE", "EXPLAIN", "APPLY"],
  HUMANITIES: ["EXPLORE", "INVESTIGATE", "COMPARE", "REASON", "APPLY"],
  LANGUAGE: ["READ", "UNDERSTAND", "ANALYZE", "CONSTRUCT", "REVISE"],
} as const satisfies Record<SubjectFamily, readonly string[]>;

/** Phases every family may also use: framing, retrieval/review and the mastery handoff. */
export const SHARED_PHASES = ["ORIENT", "RETRIEVE", "ASSESS"] as const;

export type InstructionPhase = (typeof INSTRUCTION_PATTERNS)[SubjectFamily][number] | (typeof SHARED_PHASES)[number];
export const INSTRUCTION_PHASES: readonly InstructionPhase[] = Object.freeze([...new Set([...Object.values(INSTRUCTION_PATTERNS).flat(), ...SHARED_PHASES])] as InstructionPhase[]);

export const PHASE_LABEL: Record<InstructionPhase, string> = {
  VISUALIZE: "See it", DEMONSTRATE: "Watch it solved", SOLVE_WITH_SUPPORT: "Solve with help", PRACTICE_INDEPENDENTLY: "Try it alone", ANALYZE_MISTAKE: "Find the mistake", APPLY: "Apply it",
  PREDICT: "Predict", EXPERIMENT: "Experiment", OBSERVE: "Observe", EXPLAIN: "Explain",
  EXPLORE: "Explore", INVESTIGATE: "Investigate", COMPARE: "Compare", REASON: "Reason",
  READ: "Read", UNDERSTAND: "Understand", ANALYZE: "Analyze", CONSTRUCT: "Construct", REVISE: "Revise",
  ORIENT: "Get ready", RETRIEVE: "Remember", ASSESS: "Show what you know",
};

/**
 * Phases in which learners work without support. Worked examples, guided hints and step reveals do not
 * belong in them, and their problems never show a solution before the learner has submitted an attempt.
 */
export const INDEPENDENT_PHASES: ReadonlySet<InstructionPhase> = new Set(["PRACTICE_INDEPENDENTLY", "APPLY", "REASON", "CONSTRUCT", "ASSESS"]);

/** Support blocks that would give an independent task away. */
export function isSupportBlock(block: VisualBlock): boolean {
  return block.type === "WORKED_SOLUTION" || block.type === "STEP_REVEAL" || (block.type === "NUMERIC_RESPONSE" && block.mode === "GUIDED");
}

export type SceneTeaching = Readonly<{ phase: InstructionPhase; blocks: readonly VisualBlock[]; visual?: VisualBlock }>;

export type InstructionPlan = Readonly<{
  standard: typeof V4_INSTRUCTION_STANDARD;
  /** Retrieval the lesson asks the Content Factory RETENTION resource to schedule (never scheduled here). */
  retention: Readonly<{ delayDays: number; prompts: readonly string[] }>;
}>;
