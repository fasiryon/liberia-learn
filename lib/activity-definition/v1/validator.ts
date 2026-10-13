import { z } from "zod";
import { ACTIVITY_KINDS } from "@/lib/content-bundle/v1/types";
import type { ActivityDefinitionV1 } from "./types";

export const exactIdentity = (value: string) => value.trim() === value && value.length > 0 && !/^(latest|current|\*)$/i.test(value);
const pin = z.string().refine(exactIdentity);
const ids = z.array(pin).refine(values => new Set(values).size === values.length);
const step = z.strictObject({ stepId: pin, text: z.string().min(1), resourceIds: ids });
export const rubricSchema = z.strictObject({ rubricId: pin, rubricVersion: pin, learnerVisibleCriteria: z.array(z.string()), scoringGuideResourceId: pin.nullable() });
const resource = z.strictObject({ resourceId: pin, resourceVersion: pin, kind: z.enum(["DOCUMENT", "IMAGE", "AUDIO", "VIDEO", "WORKSHEET", "MANIPULATIVE", "TEACHER_NOTE", "ANSWER_KEY", "SCORING_GUIDE"]), audience: z.enum(["LEARNER", "TEACHER", "SYSTEM"]), title: z.string().min(1), locale: pin, assetId: pin.nullable() });
const schema = z.strictObject({
  schemaVersion: z.literal("activity-definition.v1"), activityId: pin, version: pin, kind: z.enum(ACTIVITY_KINDS), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  content: z.strictObject({
    title: z.string().min(1), objectiveIds: ids.refine(values => values.length > 0), lessonItemIds: ids,
    scaffolding: z.enum(["GUIDED", "INDEPENDENT"]).nullable(), instructions: z.strictObject({ learner: z.array(step).min(1), teacher: z.array(step) }),
    resourceIds: ids, rubric: rubricSchema.nullable(), expectedDurationMinutes: z.number().int().positive(),
    collaborationMode: z.enum(["INDIVIDUAL", "PAIR", "SMALL_GROUP", "WHOLE_CLASS"]),
    evidenceIntent: z.strictObject({ kind: z.enum(["NONE", "PRACTICE_ONLY", "FORMATIVE", "SUMMATIVE_CANDIDATE"]), forms: z.array(z.enum(["WRITTEN", "ORAL", "PHOTO", "ARTIFACT", "OBSERVATION", "DIGITAL_RESPONSE"])) }),
    accessibility: z.strictObject({ readingLevel: z.string().nullable(), supportsScreenReader: z.boolean(), supportsReadAloud: z.boolean(), requiresColorVision: z.boolean(), requiresFineMotor: z.boolean(), alternativeFormatResourceIds: ids }),
  }),
  resources: z.array(resource), lessonBindings: z.array(z.strictObject({ lessonId: pin, version: pin })),
  release: z.strictObject({ releaseId: pin, releaseIdentity: pin }),
  governance: z.strictObject({ provenanceRefs: ids.refine(values => values.length > 0), reviewRefs: ids, lifecycleRefs: ids, releaseRefs: ids }),
});

export function parseActivityDefinition(input: unknown): ActivityDefinitionV1 | null {
  const parsed = schema.safeParse(input);
  // strictNullChecks is disabled in this repository, which makes Zod infer nullable
  // object fields as optional. Runtime strict schemas still require every field.
  return parsed.success ? parsed.data as ActivityDefinitionV1 : null;
}
