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
  objectives: z.array(z.string()).min(1),
  body: z.string().min(50),
  activities: z.array(z.string()).default([]),
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
});

export type CurriculumPayload = z.infer<typeof CurriculumPayloadSchema>;

export const GenerateInputSchema = z.object({
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  topic: z.string().min(1),
  moeAlignmentCodes: z.array(z.string()).optional(),
  readingLevel: z.string().optional(),
  maxWords: z.number().int().positive().optional(),
  liberiaContext: z.boolean().default(true),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;
