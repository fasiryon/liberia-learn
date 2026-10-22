import { z } from "zod";
import { TEACHING_BLOCK_REGISTRY_VERSION, BLOCK_TYPES } from "@/lib/learner-experience/teaching/registry";
import { V4_INSTRUCTION_STANDARD } from "@/lib/learner-experience/teaching/instruction";

/** Factory sidecar only. Never insert provenance or authority metadata into candidate content. */
export const VISUAL_TEACHING_CONTRACT = "visual-teaching-block/4.0.0-draft.1" as const;
export const FRONTEND_CONTRACT_COMMIT = "1268773a6" as const;
const text = z.string().trim().min(1).max(16000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const sourcePinSchema = z.strictObject({
  path: text, sha256, license: text, attribution: text,
  authenticity: z.enum(["AUTHENTIC_SOURCE", "SYNTHETIC_DEMONSTRATION"]),
  rights: z.enum(["REVIEW_ONLY", "CLEARED"]),
});
export const blockBindingSchema = z.strictObject({
  sceneId: text, slot: z.enum(["blocks", "visual"]), index: z.number().int().nonnegative(),
  type: z.enum(BLOCK_TYPES),
  blockSha256: sha256, objectiveIds: z.array(text).min(1),
  instructionalPurpose: text, misconceptionIds: z.array(text),
  responseSignals: z.array(z.strictObject({ misconceptionId: text, responsePattern: text, feedback: text })),
  accessibility: z.strictObject({ textAlternative: text, keyboardPath: text, nonColorCue: text, reducedMotion: text }),
  offline: z.strictObject({ mode: z.literal("TEXT_PAPER_CAPTURE_ONLY"), instructions: text, responsePrompt: text }),
  feedback: z.strictObject({ policy: z.literal("FORMATIVE_ONLY"), reveal: z.enum(["NONE", "MODEL", "AFTER_ATTEMPT"]), canonicalMasteryMutation: z.literal(false) }),
  sourcePins: z.array(sourcePinSchema).min(1),
});
export const visualTeachingSidecarSchema = z.strictObject({
  contractVersion: z.literal(VISUAL_TEACHING_CONTRACT), registryVersion: z.literal(TEACHING_BLOCK_REGISTRY_VERSION),
  instructionStandard: z.literal(V4_INSTRUCTION_STANDARD), candidateSha256: sha256,
  state: z.literal("DRAFT"), approved: z.literal(false), published: z.literal(false), released: z.literal(false),
  audience: z.literal("REVIEWER_ONLY"),
  objectives: z.array(z.strictObject({ id: text, statement: text,
    standards: z.array(z.strictObject({ reference: text, statement: text, relation: text, mapping: z.literal("PROPOSED") })).min(1),
  })).min(1),
  blocks: z.array(blockBindingSchema).min(1),
  assessmentBoundary: z.strictObject({ player: z.literal("ASSESSMENT_PLAYER_V2"), scoring: z.literal("SERVER_AUTHORITY"),
    protectedKeysIncluded: z.literal(false), canonicalMasteryMutation: z.literal(false),
    offlineEvidence: z.literal("CAPTURE_ONLY_NOT_OFFICIAL"),
  }),
});
export type VisualTeachingSidecar = z.infer<typeof visualTeachingSidecarSchema>;
