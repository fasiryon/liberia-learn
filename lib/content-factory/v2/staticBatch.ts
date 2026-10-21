import { z } from "zod";
import { FACTORY_ROLES } from "./blueprint";
import { bytesHash } from "./batchContract";
import { parseResourceDraft } from "./quality";
import type { FactoryExecutors } from "./types";

/** Offline author adapter. The exact JSON bytes are pinned, including unknown fields.
 * Parsing is deferred to execution so rejected outputs remain in the raw evidence file.
 */
export function staticBatchExecutors(bytes: Buffer, expectedHash: string): FactoryExecutors {
  if (bytesHash(bytes) !== expectedHash) throw new Error("batch_generation_input_hash_mismatch");
  const drafts = z.record(z.enum(FACTORY_ROLES), z.array(z.unknown())).parse(JSON.parse(bytes.toString("utf8")));
  const executor = (role: typeof FACTORY_ROLES[number]) => async () => drafts[role].map(parseResourceDraft);
  return {
    CURRICULUM_ARCHITECT: executor("CURRICULUM_ARCHITECT"), LEARNING_SCIENCE_DESIGNER: executor("LEARNING_SCIENCE_DESIGNER"),
    LESSON_AUTHOR: executor("LESSON_AUTHOR"), ASSESSMENT_DESIGNER: executor("ASSESSMENT_DESIGNER"),
    PROJECT_PRACTICAL_DESIGNER: executor("PROJECT_PRACTICAL_DESIGNER"), MEDIA_ACCESSIBILITY: executor("MEDIA_ACCESSIBILITY"),
    INDEPENDENT_QUALITY_REVIEWER: executor("INDEPENDENT_QUALITY_REVIEWER"), GOVERNANCE_RELEASE: executor("GOVERNANCE_RELEASE"),
  };
}
