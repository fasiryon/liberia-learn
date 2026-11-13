/**
 * The teaching-blocks/1.2.0 and 1.3.0 STEM blocks the student player may show, and their completion rule (CoS hook #6:
 * a new file; the frozen 1.1.0 `blockRequiresCompletion` is untouched). Lesson scenes may carry these alongside 1.1.0
 * blocks in `teaching.blocks` only (never as `teaching.visual`), and only when the package was sealed under 1.2.0 or
 * later; validateLessonExperience enforces that. Code blocks stay gated: the code-execution gate has not passed.
 */
import { blockRequiresCompletion, type VisualBlock } from "./registry";
import type { VisualBlock_1_3 } from "./registry-1.3";
import { INSTRUCTION_PHASES, PHASE_LABEL, type InstructionPhase, type SceneTeaching } from "./instruction";
import { INSTRUCTION_PHASES_1_1, INSTRUCTION_STANDARDS, PHASE_LABEL_1_1, V4_INSTRUCTION_STANDARD_1_1, type InstructionPhase_1_1 } from "./instruction-1.1";

export const STUDENT_STEM_BLOCKS = ["DESIGN_CYCLE", "MEASUREMENT_TABLE", "GRAPH_BUILDER", "OBSERVATION_LOG", "AUDIO_PROMPT"] as const;
export const GATED_CODE_BLOCKS = ["CODE_TRACE", "CODE_RUNNER", "GRID_ROBOT_PROGRAM"] as const;
export type StudentStemBlock = Extract<VisualBlock_1_3, { type: (typeof STUDENT_STEM_BLOCKS)[number] }>;
/** A block a learner scene may hold: any 1.1.0 block, or a student STEM block. */
export type LessonBlock = VisualBlock | StudentStemBlock;
/**
 * SceneTeaching (frozen instruction 1.0.0 file) with its `blocks` widened to LessonBlock and its `phase` widened to the
 * instruction 1.1.0 phases (Computing, Engineering); `visual` stays 1.1.0. Which phases a package may use depends on
 * the instruction standard it declares; validateLessonExperience enforces that.
 */
export type LessonSceneTeaching = Readonly<Omit<SceneTeaching, "blocks" | "phase"> & { phase: InstructionPhase_1_1; blocks: readonly LessonBlock[] }>;

export const isKnownInstructionStandard = (standard: string) => (INSTRUCTION_STANDARDS as readonly string[]).includes(standard);
/** A phase only instruction 1.1.0 defines: never valid in a package that does not declare 1.1.0. */
export const isInstructionPhase_1_1_only = (phase: string) => !(INSTRUCTION_PHASES as readonly string[]).includes(phase) && (INSTRUCTION_PHASES_1_1 as readonly string[]).includes(phase);
/** The phases a package declaring this instruction standard may use. */
export const phasesForInstructionStandard = (standard: string): readonly string[] => (standard === V4_INSTRUCTION_STANDARD_1_1 ? INSTRUCTION_PHASES_1_1 : INSTRUCTION_PHASES);

/** The learner-facing phase label: the frozen 1.0.0 label for a 1.0.0 phase (unchanged), the 1.1.0 label otherwise. */
export function lessonPhaseLabel(phase: InstructionPhase_1_1): string {
  return (INSTRUCTION_PHASES as readonly string[]).includes(phase) ? PHASE_LABEL[phase as InstructionPhase] : PHASE_LABEL_1_1[phase];
}

export const isStudentStemBlock = (block: { type: string }): block is StudentStemBlock => (STUDENT_STEM_BLOCKS as readonly string[]).includes(block.type);
export const isGatedCodeBlock = (block: { type: string }) => (GATED_CODE_BLOCKS as readonly string[]).includes(block.type);

/** Every student STEM block gates Continue except AUDIO_PROMPT, which never blocks a learner without sound. */
export function lessonBlockRequiresCompletion(block: LessonBlock): boolean {
  return isStudentStemBlock(block) ? block.type !== "AUDIO_PROMPT" : blockRequiresCompletion(block);
}
