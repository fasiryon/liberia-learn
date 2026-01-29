import { z } from 'zod';

export const EWOMetadataSchema = z.object({
  id: z.string().regex(/^EWO-[0-9]{5}$/),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  status: z.enum([
    'IDEA', 'RESEARCH', 'RESEARCH_IN_PROGRESS', 'RESEARCH_COMPLETE',
    'ARCHITECTURE', 'ARCHITECTURE_IN_PROGRESS', 'ARCHITECTURE_COMPLETE',
    'UI_DESIGN', 'UI_DESIGN_IN_PROGRESS', 'UI_DESIGN_COMPLETE',
    'ENGINEERING', 'ENGINEERING_IN_PROGRESS', 'ENGINEERING_COMPLETE',
    'TESTING', 'TESTING_IN_PROGRESS', 'TESTING_COMPLETE',
    'REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'
  ]),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  initiator: z.string().optional(),
  deadline: z.string().datetime().optional(),
});

export const SingleLessonEWOSchema = z.object({
  metadata: EWOMetadataSchema,
  ewo_type: z.literal('SINGLE_LESSON'),
  target: z.object({
    grade: z.enum(['GRADE_1', 'GRADE_2', /* ... all grades */ 'GRADE_12']),
    subject: z.string(),
    topic: z.string(),
    lesson_id: z.string(),
    term: z.number().min(1).max(3).optional(),
  }),
  constraints: z.object({
    offline_first: z.boolean().default(true),
    low_bandwidth: z.boolean().default(true),
    device: z.string(),
    target_region: z.string(),
    language: z.array(z.string()),
  }),
  required_agents: z.array(z.string()).min(2),
  artifacts: z.object({
    research: z.any().optional(),
    architecture: z.any().optional(),
    design: z.any().optional(),
    implementation: z.any().optional(),
    qa_report: z.any().optional(),
  }),
  history: z.array(z.any()),
});

export type SingleLessonEWO = z.infer<typeof SingleLessonEWOSchema>;
