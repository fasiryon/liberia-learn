import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const assignmentGenerationMethodSchema = z.enum([
  "manual",
  "ai_generated",
  "suggested",
]);

export const assignmentCreateSchema = z.object({
  classId: z.string().trim().min(1, "Class is required."),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  description: z.string().trim().max(4000).optional().default(""),
  dueAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    })
    .refine((value) => value === undefined || !Number.isNaN(new Date(value).getTime()), {
      message: "Due date must be a valid date.",
    }),
  points: z.coerce.number().int().min(1, "Points must be at least 1.").max(1000),
  scheduledWorkId: optionalTrimmedString,
  contentId: optionalTrimmedString,
  moeStandardCodes: z.array(z.string().trim().min(1)).max(24).optional().default([]),
  generationMethod: assignmentGenerationMethodSchema.optional().default("manual"),
});

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
