// lib/schemas/curriculumPayload.ts
import { z } from "zod";

// ─── Part 1: Delivery Profile ────────────────────────────────────────────────

const DeliveryPhaseSchema = z.object({
  name: z.string(),
  durationMinutes: z.number().int().positive(),
  description: z.string(),
});

const ExitTicketQuestionSchema = z.object({
  question: z.string(),
  type: z.enum(["mcq", "short_answer"]),
  standardCode: z.string().optional(),
  choices: z.array(z.string()).optional(),
});

const ToolRequiredSchema = z.object({
  toolKey: z.string(),
  reason: z.string(),
  phase: z.string(),
  required: z.boolean(),
});

const LabComponentSchema = z.object({
  labId: z.string().optional(),
  title: z.string(),
  type: z.string(),
  phase: z.string(),
  durationMinutes: z.number().int().positive(),
  objectives: z.array(z.string()),
});

const LabProcedureStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().min(5),
  teacherNote: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
});

const LabObservationFieldSchema = z.object({
  field: z.string().min(1),
  prompt: z.string().min(5),
  inputType: z.enum(["text", "number", "choice"]),
  choices: z.array(z.string()).nullable(),
});

const LabAnalysisQuestionSchema = z.object({
  question: z.string().min(5),
  expectedAnswer: z.string().min(5),
  scoringRubric: z.string().min(5),
});

export const LabDefinitionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  type: z.enum(["guided_walkthrough", "2d_simulation", "3d_environment"]),
  durationMinutes: z.number().int().min(20).max(60),
  subject: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  labObjective: z.string().min(5),
  materialsNeeded: z.array(z.string().min(1)).min(1),
  safetyNotes: z.string().nullable(),
  procedure: z.array(LabProcedureStepSchema).min(3),
  observationForm: z.array(LabObservationFieldSchema).min(2),
  analysisQuestions: z.array(LabAnalysisQuestionSchema).min(2),
  connectionToLesson: z.string().min(5),
  offlineCapable: z.boolean(),
  virtualAlternative: z.string().nullable(),
});

export const DeliveryProfileSchema = z.object({
  estimatedMinutes: z.number().int().positive(),
  recommendedFormat: z.enum(["standard", "block", "either"]),
  phases: z.array(DeliveryPhaseSchema),
  standardVersion: z.object({
    phases: z.array(DeliveryPhaseSchema),
    omittedActivities: z.array(z.string()),
  }),
  blockVersion: z.object({
    phases: z.array(DeliveryPhaseSchema),
    extensions: z.array(z.string()),
  }),
  splitPoint: z
    .object({
      afterPhase: z.string(),
      day2Opening: z.string(),
    })
    .optional(),
  exitTicket: z.object({
    questions: z.array(ExitTicketQuestionSchema).min(2).max(3),
  }),
  toolsRequired: z.array(ToolRequiredSchema).default([]),
  labComponent: LabComponentSchema.optional(),
});

export type DeliveryProfile = z.infer<typeof DeliveryProfileSchema>;

// ─── Curriculum Payload ───────────────────────────────────────────────────────

export const CurriculumPayloadSchema = z.object({
  title: z.string().min(3),
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  lessonFormat: z.enum(["standard", "block", "either"]).optional(),
  objectives: z.array(z.string()).min(1),
  body: z.string().min(50),
  body_standard: z.string().min(50).optional(),
  body_block: z.string().min(50).optional(),
  activities: z.array(z.string()).default([]),
  labs: z.array(LabDefinitionSchema).default([]),
  moeAlignments: z.array(z.string()).default([]),
  metadata: z
    .object({
      topic: z.string().optional(),
      locale: z.string().default("LR"),
      generatedAt: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  deliveryProfile: DeliveryProfileSchema.optional(),
}).superRefine((payload, ctx) => {
  const recommendedFormat = payload.lessonFormat ?? payload.deliveryProfile?.recommendedFormat;

  if (recommendedFormat === "standard") {
    if (!payload.body_standard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body_standard"],
        message: "body_standard is required for standard lessons",
      });
    }
    return;
  }

  if (recommendedFormat === "block") {
    if (!payload.body_block) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body_block"],
        message: "body_block is required for block lessons",
      });
    }
    return;
  }

  if (recommendedFormat === "either") {
    if (!payload.body_standard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body_standard"],
        message: "body_standard is required when both lesson formats are generated",
      });
    }
    if (!payload.body_block) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body_block"],
        message: "body_block is required when both lesson formats are generated",
      });
    }
  }
});

export type CurriculumPayload = z.infer<typeof CurriculumPayloadSchema>;

export const GenerateInputSchema = z.object({
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  topic: z.string().min(1),
  contentType: z.string().optional().default("lesson"),
  moeAlignmentCodes: z.array(z.string()).optional(),
  readingLevel: z.string().optional(),
  maxWords: z.number().int().positive().optional(),
  lessonFormat: z.enum(["standard", "block", "either"]).optional().default("standard"),
  liberiaContext: z.boolean().default(true),
  forceSmartTier: z.boolean().optional(),
});

export type GenerateInput = z.input<typeof GenerateInputSchema>;
