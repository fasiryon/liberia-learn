/** Strict generation boundary for the existing Assessment V2 contracts. No authority fields. */
import { z } from "zod";
import { ASSESSMENT_PURPOSES, ASSESSMENT_V2_SCHEMA_VERSION, COGNITIVE_DEMANDS, ITEM_TYPES,
  type AssessmentDefinitionV2, type AssessmentFormV2, type AssessmentItemV2, type ProtectedScoringSpec } from "./types";

const id = z.string().min(1).max(500).refine(s => s.trim() === s && !/^(latest|current|\*)$/i.test(s));
const text = z.string().min(1).max(16000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ids = z.array(id).max(500).refine(a => new Set(a).size === a.length);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const schemaVersion = z.literal(ASSESSMENT_V2_SCHEMA_VERSION);
const provenance = z.strictObject({ authors: z.array(z.strictObject({ kind: z.enum(["HUMAN", "AI", "IMPORTED_LEGACY"]), id })).min(1), sourceRef: id, curriculumSourceRefs: ids });
const option = z.strictObject({ optionId: id, text });
const rubric = z.strictObject({ rubricId: id, rubricVersion: version, criteria: z.array(z.strictObject({
  criterionId: id, title: text, levels: z.array(z.strictObject({ points: z.number().finite().nonnegative(), descriptor: text })).min(1),
})).min(1) });
const scoringKey = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("SINGLE_SELECT"), correctOptionId: id }),
  z.strictObject({ kind: z.literal("MULTI_SELECT"), correctOptionIds: ids.min(1), partialCredit: z.enum(["NONE", "PER_OPTION_NET"]) }),
  z.strictObject({ kind: z.literal("NUMERIC"), key: z.strictObject({ value: z.number().finite(), absoluteTolerance: z.number().finite().nonnegative(), acceptedUnits: z.array(z.string()), wrongUnitCredit: z.number().min(0).max(1) }) }),
  z.strictObject({ kind: z.literal("ORDERING"), correctOrder: ids.min(1), partialCredit: z.enum(["NONE", "ADJACENT_PAIRS"]) }),
  z.strictObject({ kind: z.literal("MATCHING"), pairs: z.array(z.strictObject({ leftId: id, rightId: id })).min(1), partialCredit: z.enum(["NONE", "PER_PAIR"]) }),
  z.strictObject({ kind: z.literal("SHORT_CONSTRUCTED"), acceptedAnswers: z.array(text).min(1), autoScore: z.enum(["EXACT_NORMALIZED", "HUMAN_ONLY"]) }),
  z.strictObject({ kind: z.literal("RUBRIC"), rubric }),
]);

export const assessmentDefinitionCandidateSchema = z.strictObject({
  schemaVersion, definitionId: id, version, contentHash: hash, title: text, purpose: z.enum(ASSESSMENT_PURPOSES), grade: z.number().int().min(1).max(12), subject: id,
  objectiveIds: ids.min(1), prerequisiteObjectiveIds: ids,
  alignment: z.strictObject({ releaseId: id, releaseIdentity: id, nationalObjectiveIds: ids, extensionObjectiveIds: ids }),
  timeLimitMinutes: z.number().positive().nullable(), permittedTools: z.array(z.strictObject({ toolId: id, mode: z.enum(["ALLOWED", "PROHIBITED"]) })),
  permittedAccommodations: z.array(z.enum(["EXTENDED_TIME", "READ_ALOUD", "LARGE_PRINT", "SCRIBE", "SEPARATE_SETTING", "ALTERNATE_LANGUAGE_SUPPORT"])),
  attemptPolicy: z.strictObject({ maxAttempts: z.number().int().positive(), cooldownMinutes: z.number().int().nonnegative(), reportedAttempt: z.enum(["FIRST", "LATEST", "HIGHEST"]) }), provenance,
});
export const assessmentItemCandidateSchema = z.strictObject({
  schemaVersion, itemId: id, version, itemHash: hash, itemType: z.enum(ITEM_TYPES),
  stimulus: z.strictObject({ prompt: text, context: text.nullable(), resourceIds: ids, options: z.array(option), orderingElements: z.array(option), matchingLeft: z.array(option), matchingRight: z.array(option), expectedUnit: text.nullable(), learnerVisibleCriteria: z.array(text) }),
  objectiveIds: ids.min(1), misconceptionIds: ids, difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]), cognitiveDemand: z.enum(COGNITIVE_DEMANDS), context: z.enum(["REHEARSED", "NEAR", "NEW"]),
  hints: z.array(z.strictObject({ hintId: id, text })),
  feedbackPolicy: z.strictObject({ hints: z.enum(["NONE", "ON_REQUEST"]), explanation: z.enum(["NEVER", "AFTER_RESPONSE", "AFTER_ATTEMPT_CLOSED", "AFTER_RELEASE_WINDOW"]), correctAnswer: z.enum(["NEVER", "AFTER_RESPONSE", "AFTER_ATTEMPT_CLOSED", "AFTER_RELEASE_WINDOW"]) }),
  scoringSpecHash: hash, provenance,
});
export const protectedScoringCandidateSchema = z.strictObject({
  schemaVersion, itemId: id, itemVersion: version, scoringVersion: version, maxPoints: z.number().finite().positive(), key: scoringKey, explanation: text.nullable(),
  misconceptionSignals: z.array(z.strictObject({ responsePattern: id, misconceptionId: id })), moderationNotes: z.array(text),
});
export const assessmentFormCandidateSchema = z.strictObject({
  schemaVersion, formId: id, version, formHash: hash, definition: z.strictObject({ definitionId: id, version, contentHash: hash }),
  items: z.array(z.strictObject({ itemId: id, itemVersion: version, itemHash: hash, points: z.number().positive() })).min(1),
  delivery: z.strictObject({ itemOrder: z.enum(["FIXED", "RANDOMIZED_BY_POLICY"]), randomizationPolicyId: id.nullable(), allowBacktracking: z.boolean(), offlineDelivery: z.enum(["PROHIBITED", "CAPTURE_ONLY"]) }),
  blueprint: z.strictObject({ blueprintVersion: version, totalPoints: z.number().positive(), objectiveCoverage: z.array(z.strictObject({ objectiveId: id, minItems: z.number().int().positive() })).min(1) }),
});
const candidateSchema = z.strictObject({ definition: assessmentDefinitionCandidateSchema, form: assessmentFormCandidateSchema,
  items: z.array(assessmentItemCandidateSchema).min(1).max(500), specs: z.array(protectedScoringCandidateSchema).min(1).max(500) });

/** The cast follows complete runtime parsing; repo strictNullChecks:false weakens Zod inference. */
export function parseCandidateAssessmentV2(input: unknown): {
  definition: AssessmentDefinitionV2; form: AssessmentFormV2; items: AssessmentItemV2[]; specs: ProtectedScoringSpec[];
} {
  return candidateSchema.parse(input) as { definition: AssessmentDefinitionV2; form: AssessmentFormV2; items: AssessmentItemV2[]; specs: ProtectedScoringSpec[] };
}
