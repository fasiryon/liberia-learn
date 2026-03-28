import { z } from "zod";

export const CurriculumSubjectSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  family: z.enum(["core", "stem", "life_career", "creative_human", "national_development"]),
  description: z.string().min(10),
  grades: z.array(z.number().int().min(1).max(12)).min(1),
  lowerPrimary: z.boolean().default(false),
  upperPrimary: z.boolean().default(false),
  juniorSecondary: z.boolean().default(false),
  seniorSecondary: z.boolean().default(false),
  waecAlignedFromGrade: z.number().int().min(1).max(12).nullable(),
  weicFocus: z.array(z.enum(["W", "E", "I", "C"])).min(1),
});

export const SeniorPathwaySchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  primarySubjects: z.array(z.string().min(1)).min(2),
  minorClusters: z.array(
    z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      electiveSubjects: z.array(z.string().min(1)).min(2),
    })
  ).min(1),
  workforceOutcomes: z.array(z.string().min(5)).min(2),
});

export const GradeBandSchema = z.object({
  code: z.enum(["G1_3", "G4_6", "G7_9", "G10_12"]),
  label: z.string().min(1),
  grades: z.array(z.number().int().min(1).max(12)).min(1),
  subjectCodes: z.array(z.string().min(1)).min(1),
  pedagogicalFocus: z.array(z.string().min(5)).min(2),
});

export const PedagogyProfileSchema = z.object({
  conceptModel: z.string().min(10),
  explanationStyle: z.string().min(10),
  practiceModel: z.string().min(10),
  assessmentStyle: z.string().min(10),
  extensionStyle: z.string().min(10),
  activityLabStyle: z.string().min(10),
});

export const SubjectPedagogySchema = z.object({
  subjectCode: z.string().min(1),
  subjectTitle: z.string().min(1),
  gradeBandProfiles: z.record(z.enum(["G1_3", "G4_6", "G7_9", "G10_12"]), PedagogyProfileSchema),
});

export const RenderabilityMetadataSchema = z.object({
  format: z.string().min(1),
  version: z.string().min(1),
  sourceLessonId: z.string().min(1),
  generationProfile: z.string().min(1),
  approved: z.boolean(),
  renderStatus: z.enum(["pending", "ready", "deferred", "failed"]),
  fallbackAvailable: z.boolean(),
});

export const VisualAssetSpecSchema = RenderabilityMetadataSchema.extend({
  title: z.string().min(3),
  objective: z.string().min(5),
  visualType: z.enum(["diagram", "chart", "illustration", "concept_visual"]),
  prompt: z.string().min(10),
  ageAppropriate: z.string().min(5),
  culturalContext: z.string().min(5),
  conceptAccuracyNotes: z.string().min(10),
  fallbackStaticText: z.string().min(10),
});

export const AudioScriptSpecSchema = RenderabilityMetadataSchema.extend({
  mode: z.enum(["teacher_narration", "student_support", "guardian_summary"]),
  script: z.string().min(20),
  pronunciationFocus: z.array(z.string().min(1)).min(1),
  readingLevel: z.string().min(2),
  durationTargetSeconds: z.number().int().min(15).max(300),
  narrationStyle: z.string().min(5),
  fallbackText: z.string().min(10),
});

export const SlideDeckSpecSchema = RenderabilityMetadataSchema.extend({
  deckTitle: z.string().min(3),
  slideCountLimit: z.number().int().min(5).max(15),
  slides: z.array(
    z.object({
      slideNumber: z.number().int().positive(),
      slideType: z.enum([
        "title",
        "objective",
        "explanation",
        "worked_example",
        "guided_practice",
        "group_task",
        "assessment_exit_ticket",
      ]),
      title: z.string().min(3),
      bullets: z.array(z.string().min(5)).min(1),
      teacherNote: z.string().min(5),
    })
  ).min(7),
  teacherPacingNotes: z.array(z.string().min(5)).min(1),
  exportIntent: z.literal("pptx_compatible"),
});

export const VideoStoryboardSpecSchema = RenderabilityMetadataSchema.extend({
  title: z.string().min(3),
  durationTargetSeconds: z.number().int().min(30).max(300),
  narrationStyle: z.string().min(5),
  sceneCountLimit: z.number().int().min(3).max(10),
  scenes: z.array(
    z.object({
      sceneNumber: z.number().int().positive(),
      sceneObjective: z.string().min(5),
      narration: z.string().min(10),
      visualDirection: z.string().min(10),
    })
  ).min(3),
  keyVisualMoments: z.array(z.string().min(5)).min(2),
  fallbackSummary: z.string().min(10),
});

export const LabDefinitionSpecSchema = RenderabilityMetadataSchema.extend({
  labType: z.enum(["classroom", "home", "simulation", "3d_future"]),
  title: z.string().min(3),
  objective: z.string().min(5),
  riskLevel: z.enum(["low", "moderate", "elevated"]),
  requiredMaterials: z.array(z.string().min(1)).min(1),
  optionalMaterials: z.array(z.string().min(1)).default([]),
  setupTimeMinutes: z.number().int().min(0).max(30),
  executionTimeMinutes: z.number().int().min(5).max(60),
  cleanupNotes: z.string().min(5),
  safetyNotes: z.string().min(5),
  procedureSteps: z.array(z.string().min(10)).min(2),
  expectedObservation: z.string().min(10),
  explanation: z.string().min(10),
  reflectionQuestions: z.array(z.string().min(5)).min(2),
  fallbackIfNoMaterials: z.string().min(10),
  simulationFallback: z.string().min(10),
  threeDReady: z.boolean(),
});

export const LessonBlueprintSchema = z.object({
  objective: z.string().min(5),
  masteryLevel: z.enum(["emerging", "secure", "advanced"]),
  waecAlignment: z.object({
    required: z.boolean(),
    examStyle: z.enum(["none", "intro", "waec_preparatory", "waec_core"]),
    referenceCodes: z.array(z.string()).default([]),
  }),
  weicTags: z.array(z.enum(["W", "E", "I", "C"])).min(1),
  teacherExplanation: z.string().min(20),
  workedExamples: z.array(z.string().min(10)).min(1),
  guidedPractice: z.array(z.string().min(10)).min(1),
  independentPractice: z.array(z.string().min(10)).min(1),
  lessonOpeningRoutine: z.string().min(10),
  classroomActivities: z.array(z.string().min(10)).min(1),
  groupWorkTask: z.string().min(10),
  projectTask: z.string().min(10),
  discussionPrompt: z.string().min(10),
  pacingGuidance: z.string().min(10),
  materialsNeeded: z.array(z.string().min(1)).min(1),
  differentiationNotes: z.array(z.string().min(10)).min(1),
  commonMisconceptions: z.array(z.string().min(10)).min(1),
  teacherNotes: z.array(z.string().min(10)).min(1),
  guardianSupportNote: z.string().min(10),
  homePracticeSuggestion: z.string().min(10),
  whatToLookFor: z.string().min(10),
  realWorldApplication: z.string().min(10),
  careerConnection: z.string().min(10),
  digitalConnection: z.string().min(10),
  visualAssetSpecs: z.array(VisualAssetSpecSchema).min(1),
  audioScriptSpecs: z.array(AudioScriptSpecSchema).min(1),
  slideDeckSpecs: z.array(SlideDeckSpecSchema).min(1),
  videoStoryboardSpecs: z.array(VideoStoryboardSpecSchema).min(1),
  labDefinitionSpecs: z.array(LabDefinitionSpecSchema).min(1),
});

export const AssessmentBlueprintSchema = z.object({
  quickChecks: z.array(z.string().min(5)).min(1),
  practiceSets: z.array(z.string().min(5)).min(1),
  quizzes: z.array(z.string().min(5)).min(1),
  remediationQuizzes: z.array(z.string().min(5)).min(1),
  challengeTasks: z.array(z.string().min(5)).min(1),
  unitTests: z.array(z.string().min(5)).min(1),
  termExams: z.array(z.string().min(5)).min(1),
  waecStyleItems: z.array(z.string().min(5)).min(1),
  itemTypes: z.array(z.enum(["MCQ", "short_answer", "word_problem", "essay", "scenario", "practical"])).min(3),
  scoringFields: z.array(z.enum(["explanation", "difficulty", "waecFlag", "weicTags"])).min(4),
});

export const GovernanceBlueprintSchema = z.object({
  curriculumVersion: z.string().min(1),
  effectiveYear: z.number().int().min(2025),
  approvalStatus: z.enum(["draft", "review", "approved", "deprecated"]),
  authorSource: z.string().min(3),
  supersedes: z.string().nullable(),
  supersededBy: z.string().nullable(),
  isNationalDefault: z.boolean(),
  isSchoolOverride: z.boolean(),
});

export const TeacherWorkloadGuardrailSchema = z.object({
  minLessonMinutes: z.number().int().min(45).max(60),
  maxLessonMinutes: z.number().int().min(45).max(60),
  maxPrepComplexity: z.enum(["low", "moderate"]),
  maxMaterialsPerLesson: z.number().int().min(4).max(10),
  pacingRule: z.string().min(10),
  planningRule: z.string().min(10),
});

export const GuardianSystemSchema = z.object({
  lessonFields: z.array(z.enum(["guardianSupportNote", "homePracticeSuggestion", "whatToLookFor"])).min(3),
  chunkType: z.literal("guardian_support"),
  communicationPolicy: z.object({
    defaultDigest: z.literal("weekly"),
    urgentAlertsOnly: z.boolean(),
    urgentTriggers: z.array(
      z.enum(["academic_decline", "repeated_missing_work", "attendance_risk", "major_exam_risk"])
    ).min(4),
    frequencyCaps: z.object({
      weeklyDigestMaxPerWeek: z.number().int().min(1),
      urgentAlertsMaxPerDay: z.number().int().min(1),
    }),
    quietHours: z.object({
      startHourLocal: z.number().int().min(0).max(23),
      endHourLocal: z.number().int().min(0).max(23),
    }),
    channelControl: z.object({
      allowSms: z.boolean(),
      allowEmail: z.boolean(),
      allowWhatsappLater: z.boolean(),
    }),
  }),
});

export const MediaLabFrameworkSchema = z.object({
  visualSupports: z.array(z.enum(["diagram", "chart", "illustration"])).min(3),
  audioSupports: z.array(z.enum(["reading_support", "explanation_summary"])).min(2),
  slideDeckFormat: z.object({
    compatibleWithPptx: z.boolean(),
    sections: z.array(z.string().min(5)).min(4),
  }),
  labSupports: z.array(z.enum(["classroom_lab", "group_experiment", "simulation_hook"])).min(3),
  threeDLabHooks: z.object({
    enabledForFutureIntegration: z.boolean(),
    requiredFields: z.array(z.enum(["lessonLinkage", "subjectRelevance", "metadataHooks"])).min(3),
  }),
});

export const MediaGenerationEngineSchema = z.object({
  stage: z.literal("after_lesson_validation_before_chunking"),
  schemaFirst: z.literal(true),
  bestEffort: z.literal(true),
  nonBlocking: z.literal(true),
  artifactTypes: z.array(
    z.enum(["VisualAssetSpec", "AudioScriptSpec", "SlideDeckSpec", "VideoStoryboardSpec", "LabDefinitionSpec"])
  ).length(5),
  failurePolicy: z.object({
    persistLessonWhenMediaFails: z.literal(true),
    allowNullDeferredMedia: z.literal(true),
    failCurriculumGenerationOnMediaError: z.literal(false),
  }),
});

export const GenerationBlueprintSchema = z.object({
  pipeline: z.tuple([
    z.literal("curriculum_blueprint"),
    z.literal("instructional_profile"),
    z.literal("lesson_generation"),
    z.literal("assessment_generation"),
    z.literal("guardian_support_generation"),
    z.literal("lesson_validation"),
    z.literal("media_generation"),
    z.literal("chunking"),
    z.literal("ingestion"),
  ]),
  freeformLessonPromptsAllowed: z.literal(false),
});

export const RagChunkBlueprintSchema = z.object({
  chunkTypes: z.array(
    z.enum([
      "concept",
      "example",
      "practice",
      "teacher_support",
      "guardian_support",
      "assessment",
      "media_support",
      "lab_support",
      "simulation_support",
      "teacher_lab_support",
      "guardian_lab_support",
    ])
  ).min(11),
  requiredFields: z.array(
    z.enum(["subject", "gradeLevel", "chunkType", "unitTitle", "lessonTitle", "waecFlag", "weicTags"])
  ).min(7),
});

export const GapFillPrioritySchema = z.object({
  firstWave: z.array(z.string().min(3)).min(4),
  secondWave: z.array(z.string().min(3)).min(2),
});

export const CurriculumFrameworkSchema = z.object({
  governance: GovernanceBlueprintSchema,
  gradeBands: z.array(GradeBandSchema).length(4),
  subjects: z.array(CurriculumSubjectSchema).min(20),
  seniorPathways: z.array(SeniorPathwaySchema).min(3),
  pedagogyMatrix: z.array(SubjectPedagogySchema).min(20),
  lessonSchema: LessonBlueprintSchema,
  assessmentSchema: AssessmentBlueprintSchema,
  teacherWorkloadGuardrails: TeacherWorkloadGuardrailSchema,
  guardianSystem: GuardianSystemSchema,
  mediaAndLabs: MediaLabFrameworkSchema,
  mediaGenerationEngine: MediaGenerationEngineSchema,
  generationBlueprint: GenerationBlueprintSchema,
  ragChunkBlueprint: RagChunkBlueprintSchema,
  gapFillPriorities: GapFillPrioritySchema,
});

export type CurriculumFramework = z.infer<typeof CurriculumFrameworkSchema>;
export type CurriculumSubject = z.infer<typeof CurriculumSubjectSchema>;
export type SeniorPathway = z.infer<typeof SeniorPathwaySchema>;
export type SubjectPedagogy = z.infer<typeof SubjectPedagogySchema>;
export type VisualAssetSpec = z.infer<typeof VisualAssetSpecSchema>;
export type AudioScriptSpec = z.infer<typeof AudioScriptSpecSchema>;
export type SlideDeckSpec = z.infer<typeof SlideDeckSpecSchema>;
export type VideoStoryboardSpec = z.infer<typeof VideoStoryboardSpecSchema>;
export type LabDefinitionSpec = z.infer<typeof LabDefinitionSpecSchema>;
