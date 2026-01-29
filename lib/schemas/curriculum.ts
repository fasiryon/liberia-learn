import { z } from 'zod';

// Convert JSON Schema to Zod
export const LearningObjectiveSchema = z.object({
  id: z.string(),
  statement: z.string(),
  bloom_level: z.enum(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE']),
  assessment_method: z.string(),
  success_criteria: z.array(z.string()).optional(),
});

export const ActivitySchema = z.object({
  id: z.string(),
  type: z.enum(['VISUAL', 'INTERACTIVE', 'PRACTICE', 'DISCUSSION', 'VIRTUAL_LAB', 'PROJECT', 'INQUIRY', 'READING', 'WRITING', 'PRESENTATION']),
  title: z.string(),
  description: z.string(),
  duration_minutes: z.number(),
  offline_capable: z.boolean(),
  instructions: z.object({
    student: z.string(),
    teacher: z.string(),
  }),
  // ... add all other fields from schema
});

export const CurriculumSchema = z.object({
  metadata: z.object({
    id: z.string(),
    version: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    status: z.enum(['draft', 'review', 'approved', 'published', 'archived']),
  }),
  educational_context: z.object({
    grade: z.number().min(1).max(12),
    subject: z.enum(['MATH', 'ENGLISH', 'SCIENCE', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'COMPUTER_SCIENCE', 'ICT', 'HISTORY', 'CIVICS', 'GEOGRAPHY', 'ECONOMICS', 'BUSINESS_STUDIES', 'ARTS', 'CREATIVITY', 'PE', 'LITERACY']),
    cognitive_band: z.enum(['FOUNDATION', 'CORE', 'SPECIALIZATION']),
    term: z.number().min(1).max(3).optional(),
    week: z.number().min(1).optional(),
  }),
  title: z.string(),
  content_type: z.enum(['LESSON', 'UNIT', 'TERM', 'FULL_SUBJECT']),
  learning_objectives: z.array(LearningObjectiveSchema),
  activities: z.array(ActivitySchema),
  // ... continue for all schema fields
});

export type Curriculum = z.infer<typeof CurriculumSchema>;

