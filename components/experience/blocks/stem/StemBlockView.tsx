"use client";

/**
 * Renderer dispatch for the teaching-blocks/1.2.0 STEM blocks the student player may show. TeachingBlockView delegates
 * here once the player validates packages by their sealed registry version (T1-STEM-PLAYER-INTEGRATION-PROPOSAL #4-#7).
 * Code blocks (CODE_TRACE, CODE_RUNNER, GRID_ROBOT_PROGRAM) are refused: the code-execution gate has not passed, so they
 * never reach a student, and package admission is asked to refuse them first. Wrap a scene in ActivityScope so a
 * GRAPH_BUILDER can read its source table.
 */
import { AudioPromptBlock } from "./AudioPromptBlock";
import { DesignCycleBlock } from "./DesignCycleBlock";
import { GraphBuilderBlock } from "./GraphBuilderBlock";
import { MeasurementTableBlock } from "./MeasurementTableBlock";
import { ObservationLogBlock } from "./ObservationLogBlock";
import type { StudentStemBlock } from "@/lib/learner-experience/teaching/stemBlocks";
export { GATED_CODE_BLOCKS, isStudentStemBlock, STUDENT_STEM_BLOCKS, type StudentStemBlock } from "@/lib/learner-experience/teaching/stemBlocks";

export function StemBlockView({ block, onDone }: { block: StudentStemBlock; onDone: (blockId: string, done: boolean) => void }) {
  switch (block.type) {
    case "DESIGN_CYCLE": return <DesignCycleBlock block={block} onDone={onDone} />;
    case "MEASUREMENT_TABLE": return <MeasurementTableBlock block={block} onDone={onDone} />;
    case "GRAPH_BUILDER": return <GraphBuilderBlock block={block} onDone={onDone} />;
    case "OBSERVATION_LOG": return <ObservationLogBlock block={block} onDone={onDone} />;
    case "AUDIO_PROMPT": return <AudioPromptBlock block={block} onDone={onDone} />;
    default: throw Error(`stem_block_not_for_students:${(block as { type: string }).type}`);
  }
}
