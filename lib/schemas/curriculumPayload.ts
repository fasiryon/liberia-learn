// lib/schemas/curriculumPayload.ts
import { z } from "zod";

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
