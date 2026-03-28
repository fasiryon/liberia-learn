import { z } from "zod";
import { AudioScriptSpecSchema, LabDefinitionSpecSchema, SlideDeckSpecSchema, VideoStoryboardSpecSchema, VisualAssetSpecSchema } from "@/lib/schemas/curriculumFramework";
import { PseudoLabSchema, SimulationDefinitionSchema, ThreeDLabDefinitionSchema } from "@/lib/schemas/labSimulation";

export const TeacherControlSchema = z.object({
  canDisableLab: z.boolean(),
  canReplaceLab: z.boolean(),
  canAdjustDifficulty: z.boolean(),
  canAssignAsHomework: z.boolean(),
});

export const GuardianModeSchema = z.object({
  simplifiedInstructions: z.string().min(10),
  noMaterialVariant: z.string().min(10),
  voiceFriendlyScript: z.string().min(20),
  guardianLoadLevel: z.enum(["low", "medium", "high"]),
  expectedGuardianEffortMinutes: z.number().int().min(1).max(30),
  supportMode: z.enum(["explanation", "observation", "guided"]),
  effectivenessSignalKeys: z.array(z.string().min(3)).min(1),
});

export const ConceptGraphSchema = z.object({
  prerequisites: z.array(z.string().min(3)).min(1),
  unlocks: z.array(z.string().min(3)).min(1),
});

export const UnitLabPlanItemSchema = z.object({
  lessonId: z.string().min(1),
  title: z.string().min(3),
  priority: z.enum(["core", "supporting", "optional"]),
  difficulty: z.enum(["intro", "standard", "advanced"]),
  simulationAttached: z.boolean(),
});

export const UnitLabPlanSchema = z.object({
  majorLabLessonId: z.string().min(1),
  majorLabPriority: z.literal("core"),
  miniLabLessonIds: z.array(z.string().min(1)).min(1),
  distributedLabs: z.array(UnitLabPlanItemSchema).min(1),
});

export const AssessmentPlanSchema = z.object({
  quickChecks: z.array(z.string().min(5)).min(1),
  practiceQuestions: z.array(z.string().min(5)).min(2),
  remediationTasks: z.array(z.string().min(5)).min(1),
  challengeTasks: z.array(z.string().min(5)).min(1),
  unitTestFocus: z.array(z.string().min(5)).min(2),
});

export const GeneratedCurriculumLessonSchema = z.object({
  lessonId: z.string().min(1),
  unitId: z.string().min(1),
  title: z.string().min(3),
  subject: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  unitTitle: z.string().min(3),
  curriculumVersion: z.string().min(1),
  generationBatchId: z.string().min(1),
  targetDifficulty: z.enum(["intro", "standard", "advanced"]),
  difficultyLevel: z.enum(["intro", "standard", "advanced"]),
  conceptGraph: ConceptGraphSchema,
  conceptTags: z.array(z.string().min(1)).min(2),
  skillTags: z.array(z.string().min(1)).min(2),
  objective: z.string().min(10),
  masteryLevel: z.enum(["emerging", "secure", "advanced"]),
  waecAlignment: z.object({
    required: z.boolean(),
    examStyle: z.enum(["none", "intro", "waec_preparatory", "waec_core"]),
    referenceCodes: z.array(z.string()).default([]),
  }),
  weicTags: z.array(z.enum(["W", "E", "I", "C"])).min(1),
  lessonOpeningRoutine: z.string().min(10),
  classroomActivities: z.array(z.string().min(10)).min(1).max(5),
  groupWorkTask: z.string().min(10),
  projectTask: z.string().min(10),
  pacingGuidance: z.string().min(10),
  materialsNeeded: z.array(z.string().min(1)).min(1),
  differentiationNotes: z.array(z.string().min(10)).min(1),
  commonMisconceptions: z.array(z.string().min(10)).min(1),
  explanation: z.string().min(20),
  workedExamples: z.array(z.string().min(10)).min(1),
  guidedPractice: z.array(z.string().min(10)).min(1),
  independentPractice: z.array(z.string().min(10)).min(1),
  quickChecks: z.array(z.string().min(5)).min(1),
  practiceQuestions: z.array(z.string().min(5)).min(2),
  remediationTasks: z.array(z.string().min(5)).min(1),
  challengeTasks: z.array(z.string().min(5)).min(1),
  guardianSupportNote: z.string().min(10),
  homePracticeSuggestion: z.string().min(10),
  whatToLookFor: z.string().min(10),
  guardianMode: GuardianModeSchema,
  realWorldApplication: z.string().min(10),
  careerConnection: z.string().min(10),
  digitalConnection: z.string().min(10),
  teacherControls: TeacherControlSchema,
  visualAssetSpecs: z.array(VisualAssetSpecSchema).nullable(),
  audioScriptSpecs: z.array(AudioScriptSpecSchema).nullable(),
  slideDeckSpecs: z.array(SlideDeckSpecSchema).nullable(),
  videoStoryboardSpecs: z.array(VideoStoryboardSpecSchema).nullable(),
  labDefinitionSpecs: z.array(LabDefinitionSpecSchema).nullable(),
  pseudoLabs: z.array(PseudoLabSchema).default([]),
  simulationDefinitions: z.array(SimulationDefinitionSchema).default([]),
  threeDLabDefinitions: z.array(ThreeDLabDefinitionSchema).default([]),
});

export const GeneratedCurriculumUnitSchema = z.object({
  unitId: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  coverage: z.enum(["full", "partial"]),
  unitTitle: z.string().min(3),
  unitObjectives: z.array(z.string().min(10)).min(2),
  unitPrerequisites: z.array(z.string().min(5)).min(2),
  lessonSequence: z.array(z.object({
    lessonId: z.string().min(1),
    title: z.string().min(3),
    order: z.number().int().positive(),
  })).min(3).max(8),
  assessmentPlan: AssessmentPlanSchema,
  unitLabPlan: UnitLabPlanSchema,
  lessons: z.array(GeneratedCurriculumLessonSchema).min(3).max(8),
});

export const CurriculumExpansionBatchSchema = z.object({
  curriculumVersion: z.string().min(1),
  generationBatchId: z.string().min(1),
  units: z.array(GeneratedCurriculumUnitSchema).min(4),
});

export type GeneratedCurriculumLesson = z.infer<typeof GeneratedCurriculumLessonSchema>;
export type GeneratedCurriculumUnit = z.infer<typeof GeneratedCurriculumUnitSchema>;
export type CurriculumExpansionBatch = z.infer<typeof CurriculumExpansionBatchSchema>;
