import { createHash } from "crypto";
import { CurriculumExpansionBatchSchema, type CurriculumExpansionBatch, type GeneratedCurriculumLesson, type GeneratedCurriculumUnit } from "@/lib/schemas/curriculumFactoryExpansion";
import { CurriculumPayloadSchema } from "@/lib/schemas/curriculumPayload";
import { generateMediaArtifactsBestEffort } from "@/lib/curriculum/mediaGeneration";
import { curriculumFramework } from "@/lib/curriculum/framework";
import { PHASE_ONE_TARGETS, SUBJECT_UNIT_THEMES } from "@/lib/curriculum/phaseOneScaleCatalog";
import { PseudoLabSchema } from "@/lib/schemas/labSimulation";

const CURRICULUM_VERSION = "2026.1";
const GENERATION_BATCH_ID = "factory-expansion-2026-03";

type DifficultyLevel = "intro" | "standard" | "advanced";
type LessonCoverage = "full" | "partial";

type LessonSeed = {
  lessonId: string;
  title: string;
  objective: string;
  targetDifficulty: DifficultyLevel;
  masteryLevel: "emerging" | "secure" | "advanced";
  conceptTags: string[];
  skillTags: string[];
  prerequisites: string[];
  unlocks: string[];
  lessonOpeningRoutine: string;
  classroomActivities: string[];
  groupWorkTask: string;
  projectTask: string;
  pacingGuidance: string;
  materialsNeeded: string[];
  differentiationNotes: string[];
  commonMisconceptions: string[];
  explanation: string;
  workedExamples: string[];
  guidedPractice: string[];
  independentPractice: string[];
  quickChecks: string[];
  practiceQuestions: string[];
  remediationTasks: string[];
  challengeTasks: string[];
  guardianSupportNote: string;
  homePracticeSuggestion: string;
  whatToLookFor: string;
  simplifiedInstructions: string;
  noMaterialVariant: string;
  voiceFriendlyScript: string;
  guardianLoadLevel: "low" | "medium" | "high";
  expectedGuardianEffortMinutes?: number;
  supportMode?: "explanation" | "observation" | "guided";
  effectivenessSignalKeys?: string[];
  realWorldApplication: string;
  careerConnection: string;
  digitalConnection: string;
  discussionPrompt: string;
  teacherNotes: string;
  lessonType: "intro" | "core" | "practice" | "review" | "assessment";
  labExposure?: "none" | "supporting" | "core";
  simulationExposure?: boolean;
  waecRequired?: boolean;
  waecExamStyle?: "none" | "intro" | "waec_preparatory" | "waec_core";
  weicTags: Array<"W" | "E" | "I" | "C">;
};

type UnitSeed = {
  unitId: string;
  subject: string;
  gradeLevel: number;
  coverage: LessonCoverage;
  unitTitle: string;
  unitObjectives: string[];
  unitPrerequisites: string[];
  assessmentPlan: {
    quickChecks: string[];
    practiceQuestions: string[];
    remediationTasks: string[];
    challengeTasks: string[];
    unitTestFocus: string[];
  };
  lessons: LessonSeed[];
};

export type CurriculumExpansionRecord = {
  contentId: string;
  grade: number;
  subject: string;
  contentType: "lesson";
  version: string;
  unitId: string;
  orderInUnit: number;
  lessonType: string;
  curriculumVersion: string;
  generationBatchId: string;
  hash: string;
  payload: Record<string, unknown>;
};

function buildContentId(subject: string, gradeLevel: number, lessonId: string) {
  return `${subject.toLowerCase()}-g${gradeLevel}-${lessonId}`;
}

function sanitizeArray(values: string[], maxItems: number) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, maxItems);
}

function hashPayload(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
}

function buildGuardianSupportMetadata(lesson: LessonSeed) {
  return {
    expectedGuardianEffortMinutes:
      lesson.expectedGuardianEffortMinutes ??
      (lesson.guardianLoadLevel === "high"
        ? 15
        : lesson.guardianLoadLevel === "medium"
          ? 10
          : 6),
    supportMode:
      lesson.supportMode ??
      (lesson.guardianLoadLevel === "medium" ? "guided" : "explanation"),
    effectivenessSignalKeys:
      lesson.effectivenessSignalKeys ??
      [
        "student_explains_key_idea",
        "student_completes_home_practice",
        "student_uses_target_vocabulary",
      ],
  } as const;
}

const SUBJECT_DEFINITIONS = new Map(
  curriculumFramework.subjects.map((subject) => [subject.code, subject])
);

const GRADE_BAND_LABELS = [
  { min: 1, max: 3, label: "Foundational" },
  { min: 4, max: 6, label: "Intermediate" },
  { min: 7, max: 9, label: "Lower Secondary" },
  { min: 10, max: 12, label: "Upper Secondary" },
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getGradeBandLabel(gradeLevel: number) {
  return GRADE_BAND_LABELS.find((band) => gradeLevel >= band.min && gradeLevel <= band.max)?.label ?? "General";
}

function subjectDisplayName(subjectCode: string) {
  return SUBJECT_DEFINITIONS.get(subjectCode)?.title ?? subjectCode.replace(/_/g, " ");
}

function buildFallbackPseudoLabs(params: {
  sourceLessonId: string;
  subject: string;
  gradeLevel: number;
  unitTitle: string;
  lessonTitle: string;
  lessonObjective: string;
  difficulty: DifficultyLevel;
  priority: "core" | "supporting";
  conceptTags: string[];
  materialsNeeded: string[];
  guardianSupportNote: string;
  labDefinitionSpecs: Array<Record<string, unknown>> | null | undefined;
}) {
  const labSpec = Array.isArray(params.labDefinitionSpecs) ? params.labDefinitionSpecs[0] : null;
  if (!labSpec) {
    return [];
  }

  return [
    PseudoLabSchema.parse({
      id: `${params.sourceLessonId}-fallback-pseudo-lab`,
      sourceLessonId: params.sourceLessonId,
      subject: params.subject,
      gradeLevel: params.gradeLevel,
      unitTitle: params.unitTitle,
      lessonTitle: params.lessonTitle,
      lessonObjective: params.lessonObjective,
      title:
        typeof labSpec.title === "string" && labSpec.title.trim()
          ? labSpec.title.trim()
          : `${params.lessonTitle} Applied Lab`,
      objective: params.lessonObjective,
      labType: "classroom",
      difficulty: params.difficulty,
      priority: params.priority,
      resourceLevel: "low",
      offlineCapable: true,
      deviceRequired: "none",
      electricityRequired: false,
      riskLevel:
        typeof labSpec.riskLevel === "string" && ["low", "medium", "high"].includes(labSpec.riskLevel)
          ? labSpec.riskLevel
          : "low",
      requiredMaterials:
        Array.isArray(labSpec.requiredMaterials) && labSpec.requiredMaterials.length > 0
          ? labSpec.requiredMaterials
          : params.materialsNeeded.slice(0, 4),
      optionalMaterials:
        Array.isArray(labSpec.optionalMaterials) ? labSpec.optionalMaterials : [],
      setupTimeMinutes:
        typeof labSpec.setupTimeMinutes === "number" ? Math.min(15, Math.max(0, Math.round(labSpec.setupTimeMinutes))) : 5,
      runTimeMinutes:
        typeof labSpec.executionTimeMinutes === "number" ? Math.min(30, Math.max(10, Math.round(labSpec.executionTimeMinutes))) : 18,
      cleanupTimeMinutes: 5,
      prepComplexity: "low",
      safetyNotes:
        typeof labSpec.safetyNotes === "string" && labSpec.safetyNotes.trim()
          ? labSpec.safetyNotes
          : "Use low-risk classroom materials and maintain supervised movement.",
      setupInstructions:
        Array.isArray(labSpec.procedureSteps) && labSpec.procedureSteps.length > 0
          ? [
              "Prepare the low-cost materials before learners begin.",
              "State the objective and model the first step clearly.",
            ]
          : [
              "Prepare the low-cost materials before learners begin.",
              "State the objective and model the first step clearly.",
            ],
      procedureSteps:
        Array.isArray(labSpec.procedureSteps) && labSpec.procedureSteps.length >= 2
          ? labSpec.procedureSteps
          : [
              `Learners complete a short hands-on task tied to ${params.lessonObjective.toLowerCase()}.`,
              "Pairs compare observations and explain what the task shows.",
            ],
      expectedObservation:
        typeof labSpec.expectedObservation === "string" && labSpec.expectedObservation.trim()
          ? labSpec.expectedObservation
          : `Students show practical evidence that they can apply ${params.lessonObjective.toLowerCase()}.`,
      explanation:
        typeof labSpec.explanation === "string" && labSpec.explanation.trim()
          ? labSpec.explanation
          : params.guardianSupportNote,
      reflectionQuestions:
        Array.isArray(labSpec.reflectionQuestions) && labSpec.reflectionQuestions.length >= 2
          ? labSpec.reflectionQuestions
          : [
              "What did you observe during the task?",
              "How does the task connect to the lesson objective?",
            ],
      extensionIdea: `Ask stronger learners to vary one condition and explain how the result changes.`,
      guardianHomeVariant: `At home, repeat a simpler version using household materials and ask the learner to explain what they noticed.`,
      fallbackMode: "teacher demonstration with board model",
      fallbackIfNoMaterials:
        typeof labSpec.fallbackIfNoMaterials === "string" && labSpec.fallbackIfNoMaterials.trim()
          ? labSpec.fallbackIfNoMaterials
          : "Use a teacher-led demonstration and oral reasoning if materials are limited.",
      expectedCompletionTimeMinutes: 20,
      expectedSuccessRate: 0.75,
      commonConfusionSignals: [
        "Learner completes the task without explaining the concept clearly",
        "Learner notices the result but cannot connect it to the lesson objective",
      ],
      conceptTags: params.conceptTags.slice(0, 3),
      simulationType: "none",
      threeDLabReady: false,
      renderStatus: "ready",
      approved: true,
    }),
  ];
}

function buildLesson(
  unit: UnitSeed,
  lesson: LessonSeed,
  order: number
): GeneratedCurriculumLesson {
  const contentId = buildContentId(unit.subject, unit.gradeLevel, lesson.lessonId);
  const media = generateMediaArtifactsBestEffort({
    sourceLessonId: contentId,
    subject: unit.subject,
    grade: unit.gradeLevel,
    unitTitle: unit.unitTitle,
    lessonTitle: lesson.title,
    objective: lesson.objective,
    teacherExplanation: lesson.explanation,
    workedExamples: lesson.workedExamples,
    guidedPractice: lesson.guidedPractice,
    groupWorkTask: lesson.groupWorkTask,
    guardianSupportNote: lesson.guardianSupportNote,
    homePracticeSuggestion: lesson.homePracticeSuggestion,
    realWorldApplication: lesson.realWorldApplication,
    digitalConnection: lesson.digitalConnection,
    materialsNeeded: lesson.materialsNeeded,
  });

  const exposeLabs = lesson.labExposure && lesson.labExposure !== "none";
  const exposeSimulation = exposeLabs && lesson.simulationExposure === true;
  const labPriority: "core" | "supporting" =
    lesson.labExposure === "core" ? "core" : "supporting";
  const guardianSupportMetadata = buildGuardianSupportMetadata(lesson);

  const pseudoLabs = exposeLabs
    ? (media.pseudoLabs.length > 0
        ? media.pseudoLabs
        : buildFallbackPseudoLabs({
            sourceLessonId: contentId,
            subject: unit.subject,
            gradeLevel: unit.gradeLevel,
            unitTitle: unit.unitTitle,
            lessonTitle: lesson.title,
            lessonObjective: lesson.objective,
            difficulty: lesson.targetDifficulty,
            priority: labPriority,
            conceptTags: lesson.conceptTags,
            materialsNeeded: lesson.materialsNeeded,
            guardianSupportNote: lesson.guardianSupportNote,
            labDefinitionSpecs: media.labDefinitionSpecs as Array<Record<string, unknown>> | null,
          })).map((lab) => ({
        ...lab,
        difficulty: lesson.targetDifficulty,
        priority: labPriority,
        approved: true,
      }))
    : [];
  const simulationDefinitions = exposeSimulation
    ? media.simulationDefinitions.map((simulation) => ({
        ...simulation,
        approved: true,
      }))
    : [];

  const generatedLesson = {
    lessonId: lesson.lessonId,
    unitId: unit.unitId,
    title: lesson.title,
    subject: unit.subject,
    gradeLevel: unit.gradeLevel,
    unitTitle: unit.unitTitle,
    curriculumVersion: CURRICULUM_VERSION,
    generationBatchId: GENERATION_BATCH_ID,
    targetDifficulty: lesson.targetDifficulty,
    difficultyLevel: lesson.targetDifficulty,
    conceptGraph: {
      prerequisites: lesson.prerequisites,
      unlocks: lesson.unlocks,
    },
    conceptTags: lesson.conceptTags,
    skillTags: lesson.skillTags,
    objective: lesson.objective,
    masteryLevel: lesson.masteryLevel,
    waecAlignment: {
      required: lesson.waecRequired ?? unit.gradeLevel >= 10,
      examStyle: lesson.waecExamStyle ?? (unit.gradeLevel >= 10 ? "waec_preparatory" : "intro"),
      referenceCodes: unit.gradeLevel >= 10 ? [`${unit.subject}-WAEC-${unit.gradeLevel}`] : [],
    },
    weicTags: lesson.weicTags,
    lessonOpeningRoutine: lesson.lessonOpeningRoutine,
    classroomActivities: sanitizeArray(lesson.classroomActivities, 5),
    groupWorkTask: lesson.groupWorkTask,
    projectTask: lesson.projectTask,
    pacingGuidance: lesson.pacingGuidance,
    materialsNeeded: sanitizeArray(lesson.materialsNeeded, 6),
    differentiationNotes: sanitizeArray(lesson.differentiationNotes, 4),
    commonMisconceptions: sanitizeArray(lesson.commonMisconceptions, 4),
    explanation: lesson.explanation,
    workedExamples: sanitizeArray(lesson.workedExamples, 3),
    guidedPractice: sanitizeArray(lesson.guidedPractice, 3),
    independentPractice: sanitizeArray(lesson.independentPractice, 3),
    quickChecks: sanitizeArray(lesson.quickChecks, 3),
    practiceQuestions: sanitizeArray(lesson.practiceQuestions, 4),
    remediationTasks: sanitizeArray(lesson.remediationTasks, 2),
    challengeTasks: sanitizeArray(lesson.challengeTasks, 2),
    guardianSupportNote: lesson.guardianSupportNote,
    homePracticeSuggestion: lesson.homePracticeSuggestion,
    whatToLookFor: lesson.whatToLookFor,
    guardianMode: {
      simplifiedInstructions: lesson.simplifiedInstructions,
      noMaterialVariant: lesson.noMaterialVariant,
      voiceFriendlyScript: lesson.voiceFriendlyScript,
      guardianLoadLevel: lesson.guardianLoadLevel,
      expectedGuardianEffortMinutes: guardianSupportMetadata.expectedGuardianEffortMinutes,
      supportMode: guardianSupportMetadata.supportMode,
      effectivenessSignalKeys: guardianSupportMetadata.effectivenessSignalKeys,
    },
    realWorldApplication: lesson.realWorldApplication,
    careerConnection: lesson.careerConnection,
    digitalConnection: lesson.digitalConnection,
    teacherControls: {
      canDisableLab: true,
      canReplaceLab: exposeLabs,
      canAdjustDifficulty: true,
      canAssignAsHomework: true,
    },
    visualAssetSpecs: media.visualAssetSpecs,
    audioScriptSpecs: media.audioScriptSpecs,
    slideDeckSpecs: media.slideDeckSpecs,
    videoStoryboardSpecs: media.videoStoryboardSpecs,
    labDefinitionSpecs: exposeLabs ? media.labDefinitionSpecs : null,
    pseudoLabs,
    simulationDefinitions,
    threeDLabDefinitions: [],
  } satisfies GeneratedCurriculumLesson;

  return generatedLesson;
}

function buildPayload(
  unit: UnitSeed,
  lesson: GeneratedCurriculumLesson,
  orderInUnit: number
): Record<string, unknown> {
  const contentId = buildContentId(unit.subject, unit.gradeLevel, lesson.lessonId);
  const payload = {
    title: lesson.title,
    lessonId: lesson.lessonId,
    unitId: unit.unitId,
    unitTitle: unit.unitTitle,
    grade: unit.gradeLevel,
    subject: unit.subject,
    objective: lesson.objective,
    objectives: [lesson.objective],
    masteryLevel: lesson.masteryLevel,
    targetDifficulty: lesson.targetDifficulty,
    difficultyLevel: lesson.difficultyLevel,
    body: lesson.explanation,
    teacherExplanation: lesson.explanation,
    workedExamples: lesson.workedExamples,
    guidedPractice: lesson.guidedPractice,
    independentPractice: lesson.independentPractice,
    lessonOpeningRoutine: lesson.lessonOpeningRoutine,
    classroomActivities: lesson.classroomActivities,
    groupWorkTask: lesson.groupWorkTask,
    projectTask: lesson.projectTask,
    discussionPrompt: "Ask learners to explain the strategy they trust most and why.",
    pacingGuidance: lesson.pacingGuidance,
    materialsNeeded: lesson.materialsNeeded,
    differentiationNotes: lesson.differentiationNotes,
    commonMisconceptions: lesson.commonMisconceptions,
    teacherNotes: `Lesson ${orderInUnit} in ${unit.unitTitle}. ${contentId}.`,
    quickChecks: lesson.quickChecks,
    practiceQuestions: lesson.practiceQuestions,
    practiceSets: lesson.practiceQuestions,
    quizzes: lesson.quickChecks,
    remediationTasks: lesson.remediationTasks,
    remediationQuizzes: lesson.remediationTasks,
    challengeTasks: lesson.challengeTasks,
    unitTests: unit.assessmentPlan.unitTestFocus,
    termExams: unit.assessmentPlan.unitTestFocus.slice(0, 2),
    waecStyleItems: lesson.waecAlignment.required ? unit.assessmentPlan.unitTestFocus : [],
    guardianSupportNote: lesson.guardianSupportNote,
    homePracticeSuggestion: lesson.homePracticeSuggestion,
    whatToLookFor: lesson.whatToLookFor,
    simplifiedInstructions: lesson.guardianMode.simplifiedInstructions,
    noMaterialVariant: lesson.guardianMode.noMaterialVariant,
    voiceFriendlyScript: lesson.guardianMode.voiceFriendlyScript,
    guardianLoadLevel: lesson.guardianMode.guardianLoadLevel,
    expectedGuardianEffortMinutes: lesson.guardianMode.expectedGuardianEffortMinutes,
    supportMode: lesson.guardianMode.supportMode,
    effectivenessSignalKeys: lesson.guardianMode.effectivenessSignalKeys,
    realWorldApplication: lesson.realWorldApplication,
    careerConnection: lesson.careerConnection,
    digitalConnection: lesson.digitalConnection,
    conceptGraph: lesson.conceptGraph,
    conceptTags: lesson.conceptTags,
    skillTags: lesson.skillTags,
    curriculumVersion: lesson.curriculumVersion,
    generationBatchId: lesson.generationBatchId,
    orderInUnit,
    lessonType: "core",
    mediaGenerationStatus: "ready",
    mediaGenerationErrors: [],
    visualAssetSpecs: lesson.visualAssetSpecs,
    audioScriptSpecs: lesson.audioScriptSpecs,
    slideDeckSpecs: lesson.slideDeckSpecs,
    videoStoryboardSpecs: lesson.videoStoryboardSpecs,
    labDefinitionSpecs: lesson.labDefinitionSpecs,
    pseudoLabs: lesson.pseudoLabs,
    simulationDefinitions: lesson.simulationDefinitions,
    threeDLabDefinitions: lesson.threeDLabDefinitions,
    labs: [],
    activities: lesson.classroomActivities,
    moeAlignments: lesson.waecAlignment.referenceCodes,
    weicTags: lesson.weicTags,
    waecAlignment: lesson.waecAlignment,
  } satisfies Record<string, unknown>;

  CurriculumPayloadSchema.parse({
    title: payload.title,
    grade: payload.grade,
    subject: payload.subject,
    objectives: payload.objectives,
    body: payload.body,
    activities: payload.activities,
    labs: payload.labs,
    moeAlignments: payload.moeAlignments,
  });

  return payload;
}

function validateUnitConceptGraph(unit: GeneratedCurriculumUnit): string[] {
  const errors: string[] = [];
  const baselineConcepts = unit.unitPrerequisites.map((value) => value.trim().toLowerCase());
  const conceptFirstSeenAt = new Map<string, number>();

  const toTokens = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
      .map((token) => token.replace(/(ing|ed|es|s)$/u, ""));

  const phrasesOverlap = (left: string, right: string) => {
    const leftTokens = toTokens(left);
    const rightTokens = toTokens(right);

    return leftTokens.some((leftToken) =>
      rightTokens.some(
        (rightToken) =>
          leftToken === rightToken ||
          (leftToken.length >= 5 && rightToken.startsWith(leftToken)) ||
          (rightToken.length >= 5 && leftToken.startsWith(rightToken))
      )
    );
  };

  unit.lessons.forEach((lesson, index) => {
    for (const concept of [...lesson.conceptTags, ...lesson.conceptGraph.unlocks]) {
      const normalized = concept.trim().toLowerCase();
      if (!conceptFirstSeenAt.has(normalized)) {
        conceptFirstSeenAt.set(normalized, index);
      }
    }
  });

  unit.lessons.forEach((lesson, index) => {
    const lessonConcepts = new Set(
      [...lesson.conceptTags, ...lesson.conceptGraph.unlocks].map((value) => value.trim().toLowerCase())
    );
    const earlierKnowledge = [
      ...baselineConcepts,
      ...unit.lessons
        .slice(0, index)
        .flatMap((priorLesson) => [...priorLesson.conceptTags, ...priorLesson.conceptGraph.unlocks])
        .map((value) => value.trim().toLowerCase()),
    ];
    const futureKnowledge = unit.lessons
      .slice(index + 1)
      .flatMap((futureLesson) => [...futureLesson.conceptTags, ...futureLesson.conceptGraph.unlocks])
      .map((value) => value.trim().toLowerCase());

    for (const prerequisite of lesson.conceptGraph.prerequisites) {
      const normalized = prerequisite.trim().toLowerCase();

      if (lessonConcepts.has(normalized)) {
        errors.push(`${unit.unitId}:${lesson.lessonId}:self_dependency:${normalized}`);
        continue;
      }

      if (index === 0) {
        continue;
      }

      if (
        earlierKnowledge.some(
          (knowledge) => knowledge === normalized || phrasesOverlap(knowledge, normalized)
        )
      ) {
        continue;
      }

      if (
        futureKnowledge.some(
          (knowledge) => knowledge === normalized || phrasesOverlap(knowledge, normalized)
        )
      ) {
        errors.push(`${unit.unitId}:${lesson.lessonId}:order_violation:${normalized}`);
        continue;
      }

      const firstSeen = conceptFirstSeenAt.get(normalized);
      if (firstSeen != null && firstSeen >= index) {
        errors.push(`${unit.unitId}:${lesson.lessonId}:order_violation:${normalized}`);
        continue;
      }

      errors.push(`${unit.unitId}:${lesson.lessonId}:broken_reference:${normalized}`);
    }
  });

  return errors;
}

export function validateCurriculumExpansionBatch(batch: CurriculumExpansionBatch) {
  const errors = batch.units.flatMap(validateUnitConceptGraph);
  return {
    valid: errors.length === 0,
    errors,
  };
}

type GeneratedLessonSeedInput = {
  lessonId: string;
  title: string;
  objective: string;
  targetDifficulty: DifficultyLevel;
  masteryLevel: "emerging" | "secure" | "advanced";
  conceptTags: string[];
  skillTags: string[];
  prerequisites?: string[];
  unlocks?: string[];
  lessonType: "intro" | "core" | "practice" | "review" | "assessment";
  unitTitle: string;
  subjectLabel: string;
  guardianLoadLevel?: "low" | "medium" | "high";
  labExposure?: "none" | "supporting" | "core";
  simulationExposure?: boolean;
  realWorldApplication: string;
  careerConnection: string;
  digitalConnection: string;
  weicTags: Array<"W" | "E" | "I" | "C">;
};

function createStructuredLessonSeed(input: GeneratedLessonSeedInput): LessonSeed {
  const prerequisites = input.prerequisites ?? [];
  const unlocks = input.unlocks ?? [];
  const primaryPrerequisite = prerequisites[0] ?? `${input.subjectLabel.toLowerCase()} foundations`;
  const primaryUnlock = unlocks[0] ?? `${input.subjectLabel.toLowerCase()} transfer`;
  const primaryConcept = input.conceptTags[0] ?? input.title.toLowerCase();
  const primarySkill = input.skillTags[0] ?? `applying ${primaryConcept}`;

  return {
    lessonId: input.lessonId,
    title: input.title,
    objective: input.objective,
    targetDifficulty: input.targetDifficulty,
    masteryLevel: input.masteryLevel,
    conceptTags: input.conceptTags,
    skillTags: input.skillTags,
    prerequisites: prerequisites.length > 0 ? prerequisites : [primaryPrerequisite],
    unlocks: unlocks.length > 0 ? unlocks : [`${primaryConcept} application`],
    lessonOpeningRoutine: `Start ${input.title} with one short retrieval question linked to ${input.unitTitle}.`,
    classroomActivities: [
      `Model ${input.objective.toLowerCase()} with one teacher-led example.`,
      `Guide learners through a paired ${input.subjectLabel.toLowerCase()} task using the lesson vocabulary.`,
    ],
    groupWorkTask: `Groups solve one ${input.subjectLabel.toLowerCase()} problem tied to ${input.title} and explain the strategy used.`,
    projectTask: `Create a short artifact that shows how ${input.title.toLowerCase()} applies in a Liberia-relevant context.`,
    pacingGuidance: "Use a short explanation, then protect practice and discussion time before the exit task.",
    materialsNeeded: ["exercise books", "board", "pencils"],
    differentiationNotes: [
      "Use worked examples and sentence frames for learners who need more structure.",
      "Extend stronger learners with one transfer or justification prompt.",
    ],
    commonMisconceptions: [
      `Learners may confuse ${primaryConcept} with earlier simpler procedures.`,
      "Learners may answer correctly without explaining the reasoning clearly.",
    ],
    explanation: `${input.objective} The lesson builds from ${primaryPrerequisite} toward ${primaryUnlock} using explicit modeling, structured practice, and explanation.`,
    workedExamples: [
      `Model one full solution connected to ${primaryConcept}.`,
      `Compare two solution paths and explain which is more efficient for ${primarySkill}.`,
    ],
    guidedPractice: [
      `Solve one scaffolded task focused on ${primaryConcept}.`,
      `Explain the reasoning for a second task using ${primarySkill}.`,
    ],
    independentPractice: [
      `Complete one independent item on ${primaryConcept}.`,
      `Apply the idea in a short context involving ${input.realWorldApplication.toLowerCase()}.`,
    ],
    quickChecks: [`State the key idea behind ${primaryConcept} in one clear sentence.`],
    practiceQuestions: [
      `Solve one problem using ${primarySkill}.`,
      `Explain how ${primaryConcept} supports the final answer.`,
    ],
    remediationTasks: [`Rework the first example with a teacher or partner and narrate each step aloud.`],
    challengeTasks: [`Apply ${primaryConcept} in a less familiar exam-style or real-world problem.`],
    guardianSupportNote: `Ask the learner to explain ${primaryConcept} using one example from the lesson, not only the final answer.`,
    homePracticeSuggestion: `Review one short task on ${primaryConcept} and ask the learner to explain the reasoning aloud.`,
    whatToLookFor: "Listen for correct vocabulary, clear reasoning, and whether the learner can explain why the method works.",
    simplifiedInstructions: `Ask the learner to show one example of ${primaryConcept} and explain each step simply.`,
    noMaterialVariant: `Use oral reasoning and one written example if no extra materials are available for ${input.title}.`,
    voiceFriendlyScript: `Explain ${primaryConcept} in your own words, then talk through one example from start to finish.`,
    guardianLoadLevel: input.guardianLoadLevel ?? "medium",
    expectedGuardianEffortMinutes: input.guardianLoadLevel === "low" ? 6 : 10,
    supportMode: input.guardianLoadLevel === "low" ? "explanation" : "guided",
    effectivenessSignalKeys: [
      "student_explains_strategy",
      "student_uses_key_vocabulary",
      "student_completes_short_home_task",
    ],
    realWorldApplication: input.realWorldApplication,
    careerConnection: input.careerConnection,
    digitalConnection: input.digitalConnection,
    discussionPrompt: `Which strategy in ${input.title} is most reliable, and why?`,
    teacherNotes: `Keep ${input.title} focused on the objective and ask for verbal justification before moving on.`,
    lessonType: input.lessonType,
    labExposure: input.labExposure,
    simulationExposure: input.simulationExposure,
    weicTags: input.weicTags,
  };
}

function buildSubjectConnections(subjectCode: string, subjectLabel: string, themeTitle: string) {
  const lowerLabel = subjectLabel.toLowerCase();
  const themeLower = themeTitle.toLowerCase();

  const defaults = {
    realWorldApplication: `${themeTitle} connects ${lowerLabel} learning to Liberia-relevant classroom, home, and community decisions.`,
    careerConnection: `${themeTitle} builds habits used in teaching, technical work, entrepreneurship, and community leadership.`,
    digitalConnection: `${themeTitle} can be reinforced with simple digital tools when available, with a clear offline equivalent kept in the lesson.`,
    weicTags: ["W", "C"] as Array<"W" | "E" | "I" | "C">,
  };

  switch (subjectCode) {
    case "MATH":
      return {
        realWorldApplication: `${themeTitle} supports budgeting, measurement, trade, planning, and fair sharing decisions.`,
        careerConnection: `${themeTitle} is used in business, engineering, logistics, agriculture, and technical trades.`,
        digitalConnection: `${themeTitle} can be checked with calculators, graphing tools, or spreadsheets without replacing manual reasoning.`,
        weicTags: ["W", "I", "E"] as Array<"W" | "E" | "I" | "C">,
      };
    case "SCIENCE":
      return {
        realWorldApplication: `${themeTitle} helps learners explain observations about health, farming, environment, energy, and everyday materials.`,
        careerConnection: `${themeTitle} supports agriculture, health, laboratory work, engineering, and environmental roles.`,
        digitalConnection: `${themeTitle} can be extended through simple simulations, photo observation, or data logging where devices exist.`,
        weicTags: ["W", "I", "C"] as Array<"W" | "E" | "I" | "C">,
      };
    case "COMPUTER_SCIENCE":
    case "AI_LITERACY":
    case "DATA_LITERACY":
    case "DIGITAL_LITERACY":
    case "ENGINEERING_FOUNDATIONS":
      return {
        realWorldApplication: `${themeTitle} strengthens practical digital and systems thinking for school, work, and community problem solving.`,
        careerConnection: `${themeTitle} connects to ICT support, engineering pathways, data work, and digital entrepreneurship.`,
        digitalConnection: `${themeTitle} naturally uses digital tools when available but always keeps an offline reasoning path.`,
        weicTags: ["W", "I", "E"] as Array<"W" | "E" | "I" | "C">,
      };
    case "CIVICS":
    case "SOCIAL_STUDIES":
    case "ENVIRONMENTAL_STUDIES":
      return {
        realWorldApplication: `${themeTitle} helps learners understand how people, communities, and institutions make decisions together.`,
        careerConnection: `${themeTitle} prepares learners for public service, teaching, journalism, planning, and civic leadership.`,
        digitalConnection: `${themeTitle} can use maps, timelines, or data displays when available, while remaining fully teachable offline.`,
        weicTags: ["C", "W"] as Array<"W" | "E" | "I" | "C">,
      };
    case "BUSINESS_ENTREPRENEURSHIP":
    case "FINANCIAL_LITERACY":
    case "CAREER_EXPLORATION":
      return {
        realWorldApplication: `${themeTitle} links school learning to savings, enterprise, budgeting, and career planning.`,
        careerConnection: `${themeTitle} builds readiness for business, management, trade, and self-employment opportunities.`,
        digitalConnection: `${themeTitle} can be reinforced with simple record-keeping and presentation tools when devices are available.`,
        weicTags: ["W", "E", "C"] as Array<"W" | "E" | "I" | "C">,
      };
    case "AGRICULTURE":
    case "ENERGY_INFRASTRUCTURE":
      return {
        realWorldApplication: `${themeTitle} connects directly to food systems, infrastructure reliability, and local development needs.`,
        careerConnection: `${themeTitle} supports agriculture modernization, technical support roles, and infrastructure awareness.`,
        digitalConnection: `${themeTitle} can use measurement and monitoring tools where available without creating dependence on devices.`,
        weicTags: ["W", "E", "I"] as Array<"W" | "E" | "I" | "C">,
      };
    default:
      return defaults;
  }
}

function shouldExposeSimulation(subjectCode: string, unitIndex: number) {
  return ["MATH", "SCIENCE", "COMPUTER_SCIENCE", "AI_LITERACY", "DATA_LITERACY", "DIGITAL_LITERACY"].includes(subjectCode)
    && unitIndex % 4 === 0;
}

function createGeneratedPhaseUnitSeed(params: {
  gradeLevel: number;
  subjectCode: string;
  subjectLabel: string;
  coverage: LessonCoverage;
  themeTitle: string;
  unitIndex: number;
}) {
  const normalizedTheme = slugify(params.themeTitle);
  const unitId = `${params.subjectCode.toLowerCase()}-g${params.gradeLevel}-${normalizedTheme}`;
  const bandLabel = getGradeBandLabel(params.gradeLevel);
  const connections = buildSubjectConnections(params.subjectCode, params.subjectLabel, params.themeTitle);
  const baseConcept = `${params.subjectLabel.toLowerCase()} ${params.themeTitle.toLowerCase()}`;
  const subjectFoundations = `${params.subjectLabel.toLowerCase()} foundations`;
  const simulationExposure = shouldExposeSimulation(params.subjectCode, params.unitIndex);

  const lessons = [
    createStructuredLessonSeed({
      lessonId: `${normalizedTheme}-foundations`,
      title: `${params.themeTitle}: Foundations`,
      objective: `Build a clear foundation in ${params.themeTitle.toLowerCase()} for Grade ${params.gradeLevel} ${params.subjectLabel.toLowerCase()} learners.`,
      targetDifficulty: "intro",
      masteryLevel: "emerging",
      conceptTags: [baseConcept, `${params.subjectLabel.toLowerCase()} vocabulary`],
      skillTags: [`explaining ${params.themeTitle.toLowerCase()}`, `identifying key ideas`],
      prerequisites: [subjectFoundations],
      unlocks: [`${params.themeTitle.toLowerCase()} application`],
      lessonType: "intro",
      unitTitle: params.themeTitle,
      subjectLabel: params.subjectLabel,
      guardianLoadLevel: "low",
      labExposure: "none",
      simulationExposure: false,
      realWorldApplication: connections.realWorldApplication,
      careerConnection: connections.careerConnection,
      digitalConnection: connections.digitalConnection,
      weicTags: connections.weicTags,
    }),
    createStructuredLessonSeed({
      lessonId: `${normalizedTheme}-application`,
      title: `${params.themeTitle}: Guided Application`,
      objective: `Apply ${params.themeTitle.toLowerCase()} in structured classroom and community-linked tasks.`,
      targetDifficulty: "standard",
      masteryLevel: "secure",
      conceptTags: [`${baseConcept} application`, `${params.subjectLabel.toLowerCase()} reasoning`],
      skillTags: [`applying ${params.themeTitle.toLowerCase()}`, "explaining method"],
      prerequisites: [baseConcept],
      unlocks: [`${params.themeTitle.toLowerCase()} transfer`],
      lessonType: "core",
      unitTitle: params.themeTitle,
      subjectLabel: params.subjectLabel,
      guardianLoadLevel: "medium",
      labExposure: "supporting",
      simulationExposure: false,
      realWorldApplication: connections.realWorldApplication,
      careerConnection: connections.careerConnection,
      digitalConnection: connections.digitalConnection,
      weicTags: connections.weicTags,
    }),
    createStructuredLessonSeed({
      lessonId: `${normalizedTheme}-performance`,
      title: `${params.themeTitle}: Performance and Reflection`,
      objective: `Demonstrate secure understanding of ${params.themeTitle.toLowerCase()} through explanation, practice, and reflection.`,
      targetDifficulty: "advanced",
      masteryLevel: "advanced",
      conceptTags: [`${baseConcept} transfer`, `${params.subjectLabel.toLowerCase()} communication`],
      skillTags: ["performance task", "reflecting on strategy"],
      prerequisites: [`${params.themeTitle.toLowerCase()} application`],
      unlocks: [`${params.themeTitle.toLowerCase()} mastery`],
      lessonType: "assessment",
      unitTitle: params.themeTitle,
      subjectLabel: params.subjectLabel,
      guardianLoadLevel: "medium",
      labExposure: "core",
      simulationExposure,
      realWorldApplication: connections.realWorldApplication,
      careerConnection: connections.careerConnection,
      digitalConnection: connections.digitalConnection,
      weicTags: connections.weicTags,
    }),
  ];

  return {
    unitId,
    subject: params.subjectCode,
    gradeLevel: params.gradeLevel,
    coverage: params.coverage,
    unitTitle: params.themeTitle,
    unitObjectives: [
      `Develop grade-appropriate understanding of ${params.themeTitle.toLowerCase()} in ${params.subjectLabel}.`,
      `Use ${params.themeTitle.toLowerCase()} in teacher-guided, independent, and applied classroom tasks.`,
    ],
    unitPrerequisites: [subjectFoundations, `${bandLabel.toLowerCase()} readiness`],
    assessmentPlan: {
      quickChecks: [
        `State the key idea in ${params.themeTitle.toLowerCase()} clearly.`,
        `Explain one example from ${params.themeTitle.toLowerCase()} using the lesson vocabulary.`,
      ],
      practiceQuestions: [
        `Complete one guided task from ${params.themeTitle.toLowerCase()}.`,
        `Apply ${params.themeTitle.toLowerCase()} in a Liberia-relevant context.`,
      ],
      remediationTasks: [
        `Return to the worked example from ${params.themeTitle.toLowerCase()} and narrate the reasoning.`,
      ],
      challengeTasks: [
        `Transfer ${params.themeTitle.toLowerCase()} to a more demanding task or new scenario.`,
      ],
      unitTestFocus: lessons.map((lesson) => lesson.title),
    },
    lessons,
  } satisfies UnitSeed;
}

function createPhaseOneGeneratedUnitSeeds(existingSeeds: UnitSeed[]): UnitSeed[] {
  const existingCounts = new Map<string, number>();
  for (const seed of existingSeeds) {
    const key = `${seed.subject}-g${seed.gradeLevel}`;
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }

  const generated: UnitSeed[] = [];

  for (const target of PHASE_ONE_TARGETS) {
    const subject = SUBJECT_DEFINITIONS.get(target.subjectCode);
    const themes = SUBJECT_UNIT_THEMES[target.subjectCode] ?? [];
    const existingCount = existingCounts.get(`${target.subjectCode}-g${target.gradeLevel}`) ?? 0;
    const themesToGenerate = themes.slice(existingCount);

    for (const [index, themeTitle] of themesToGenerate.entries()) {
      if (!subject) {
        continue;
      }

      generated.push(
        createGeneratedPhaseUnitSeed({
          gradeLevel: target.gradeLevel,
          subjectCode: target.subjectCode,
          subjectLabel: subject.title,
          coverage: target.coverage,
          themeTitle,
          unitIndex: existingCount + index,
        })
      );
    }
  }

  return generated;
}

function createGrade10MathUnitSeeds(): UnitSeed[] {
  const unitSpecs = [
    {
      unitId: "math-g10-ratio-proportional-reasoning",
      unitTitle: "Ratio and Proportional Reasoning",
      unitObjectives: ["Use ratios, rates, and proportions to model real situations.", "Explain proportional relationships with tables, graphs, and equations."],
      unitPrerequisites: ["ratio language", "multiplicative reasoning"],
      lessons: [
        { lessonId: "g10-ratio-language-and-rate", title: "Ratio Language and Rate Interpretation", objective: "Interpret ratios and rates in Grade 10 contexts.", conceptTags: ["ratio reasoning", "rates"], skillTags: ["interpreting ratios", "comparing quantities"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-proportional-tables-and-graphs", title: "Proportional Tables and Graphs", objective: "Represent proportional relationships using tables and graphs.", conceptTags: ["proportional relationships", "tables", "graphs"], skillTags: ["reading proportional graphs", "building tables"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-solving-proportion-problems", title: "Solving Proportion Problems", objective: "Solve proportion problems and justify the method used.", conceptTags: ["proportions", "cross multiplication"], skillTags: ["solving proportions", "justifying solutions"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-scale-and-percentage-change",
      unitTitle: "Scale, Rate, and Percentage Change",
      unitObjectives: ["Use scale and percentage change to solve classroom and market problems.", "Connect rates to proportional comparisons."],
      unitPrerequisites: ["percentage basics", "ratio reasoning"],
      lessons: [
        { lessonId: "g10-scale-factor-basics", title: "Scale Factor Basics", objective: "Use scale factors to enlarge and reduce quantities.", conceptTags: ["scale factor", "multiplicative change"], skillTags: ["using scale factors", "checking reasonableness"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-percentage-increase-and-decrease", title: "Percentage Increase and Decrease", objective: "Calculate percentage increase and decrease in applied problems.", conceptTags: ["percentage change", "increase", "decrease"], skillTags: ["calculating percentages", "interpreting change"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-multi-step-rate-problems", title: "Multi-Step Rate Problems", objective: "Solve multi-step rate and percentage problems.", conceptTags: ["rate problems", "multi-step reasoning"], skillTags: ["multi-step problem solving", "evaluating rates"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-algebraic-expressions",
      unitTitle: "Algebraic Expressions and Structure",
      unitObjectives: ["Simplify and interpret algebraic expressions.", "Use structure to reason about equivalent expressions."],
      unitPrerequisites: ["integer operations", "variable notation"],
      lessons: [
        { lessonId: "g10-variables-and-terms", title: "Variables, Terms, and Structure", objective: "Identify terms, coefficients, and variables in algebraic expressions.", conceptTags: ["terms", "coefficients", "variables"], skillTags: ["reading expressions", "identifying structure"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-combining-like-terms", title: "Combining Like Terms", objective: "Simplify expressions by combining like terms correctly.", conceptTags: ["like terms", "expression simplification"], skillTags: ["simplifying expressions", "checking equivalence"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-equivalent-expressions", title: "Equivalent Expressions", objective: "Explain why two algebraic expressions are equivalent.", conceptTags: ["equivalent expressions", "distributive reasoning"], skillTags: ["justifying equivalence", "rewriting expressions"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-linear-equations",
      unitTitle: "Linear Equations in One Variable",
      unitObjectives: ["Solve linear equations accurately.", "Explain inverse operations and balance reasoning."],
      unitPrerequisites: ["expression simplification", "integer operations"],
      lessons: [
        { lessonId: "g10-balance-and-inverse-operations", title: "Balance and Inverse Operations", objective: "Explain why inverse operations solve equations.", conceptTags: ["inverse operations", "balance"], skillTags: ["balancing equations", "explaining operations"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-solving-one-step-and-two-step", title: "Solving One-Step and Two-Step Equations", objective: "Solve one-step and two-step linear equations.", conceptTags: ["one-step equations", "two-step equations"], skillTags: ["solving equations", "checking solutions"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-equation-word-problems", title: "Equation Word Problems", objective: "Translate word problems into linear equations and solve them.", conceptTags: ["equation modeling", "word problems"], skillTags: ["translating contexts", "solving modeled equations"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-simultaneous-equations",
      unitTitle: "Simultaneous Linear Equations",
      unitObjectives: ["Solve simple simultaneous equations.", "Interpret the meaning of a shared solution."],
      unitPrerequisites: ["linear equations", "ordered pairs"],
      lessons: [
        { lessonId: "g10-systems-as-two-relations", title: "Systems as Two Relations", objective: "Interpret a system as two relationships considered together.", conceptTags: ["systems of equations", "shared solution"], skillTags: ["interpreting systems", "reading structure"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-solving-by-substitution", title: "Solving by Substitution", objective: "Solve simple simultaneous equations by substitution.", conceptTags: ["substitution", "simultaneous equations"], skillTags: ["solving systems", "checking shared solutions"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-system-context-problems", title: "Context Problems with Systems", objective: "Model and solve context problems using simultaneous equations.", conceptTags: ["system modeling", "intersection meaning"], skillTags: ["modeling contexts", "interpreting solutions"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-inequalities",
      unitTitle: "Inequalities and Constraints",
      unitObjectives: ["Solve and interpret inequalities.", "Use inequalities to describe constraints."],
      unitPrerequisites: ["linear equations", "number line reasoning"],
      lessons: [
        { lessonId: "g10-inequality-symbols-and-meaning", title: "Inequality Symbols and Meaning", objective: "Interpret inequality symbols and solution statements.", conceptTags: ["inequalities", "solution sets"], skillTags: ["reading inequalities", "describing constraints"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-solving-linear-inequalities", title: "Solving Linear Inequalities", objective: "Solve linear inequalities and show the solution set.", conceptTags: ["linear inequalities", "solution intervals"], skillTags: ["solving inequalities", "graphing on number lines"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-constraint-word-problems", title: "Constraint Word Problems", objective: "Use inequalities to model and solve simple constraint problems.", conceptTags: ["constraints", "inequality modeling"], skillTags: ["modeling constraints", "interpreting feasible values"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-linear-functions",
      unitTitle: "Linear Functions and Patterns",
      unitObjectives: ["Connect linear patterns to function rules.", "Interpret constant rate of change."],
      unitPrerequisites: ["ordered pairs", "ratio reasoning"],
      lessons: [
        { lessonId: "g10-patterns-and-rules", title: "Patterns and Rules", objective: "Identify linear patterns and express a rule.", conceptTags: ["patterns", "function rules"], skillTags: ["describing patterns", "writing rules"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-rate-of-change", title: "Rate of Change", objective: "Interpret rate of change in a linear relationship.", conceptTags: ["rate of change", "linear growth"], skillTags: ["interpreting slope informally", "comparing changes"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-function-context-reasoning", title: "Function Reasoning in Context", objective: "Use linear functions to reason about real situations.", conceptTags: ["linear functions", "context interpretation"], skillTags: ["interpreting functions", "reasoning from tables"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-graphing-linear-relationships",
      unitTitle: "Graphing Linear Relationships",
      unitObjectives: ["Represent linear relationships on coordinate axes.", "Interpret slope and intercept informally."],
      unitPrerequisites: ["ordered pairs", "linear functions"],
      lessons: [
        { lessonId: "g10-coordinate-review", title: "Coordinate Review for Linear Graphs", objective: "Plot and interpret ordered pairs on the coordinate plane.", conceptTags: ["ordered pairs", "coordinate plane"], skillTags: ["plotting points", "reading coordinates"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-graphing-from-tables", title: "Graphing from Tables", objective: "Graph linear relationships from value tables.", conceptTags: ["graphing linear tables", "visual patterns"], skillTags: ["drawing graphs", "connecting tables to graphs"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-graph-interpretation", title: "Graph Interpretation", objective: "Interpret intercepts and trend from linear graphs.", conceptTags: ["graph interpretation", "intercepts"], skillTags: ["interpreting graphs", "justifying conclusions"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-sequences-and-recursive-reasoning",
      unitTitle: "Sequences and Recursive Reasoning",
      unitObjectives: ["Describe arithmetic sequences.", "Connect sequence rules to algebraic reasoning."],
      unitPrerequisites: ["patterns", "integer operations"],
      lessons: [
        { lessonId: "g10-sequence-patterns", title: "Sequence Patterns", objective: "Identify arithmetic sequence patterns from examples.", conceptTags: ["arithmetic sequences", "common difference"], skillTags: ["finding patterns", "describing sequences"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-recursive-rules", title: "Recursive Rules", objective: "Write recursive rules for arithmetic sequences.", conceptTags: ["recursive rules", "common difference"], skillTags: ["writing recursive rules", "checking sequence growth"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-sequence-problem-solving", title: "Sequence Problem Solving", objective: "Use arithmetic sequence reasoning in context problems.", conceptTags: ["sequence problem solving", "nth reasoning"], skillTags: ["applying sequences", "explaining growth"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-factoring-and-structure",
      unitTitle: "Factoring and Algebraic Structure",
      unitObjectives: ["Use factoring to rewrite expressions.", "Recognize structure in algebraic forms."],
      unitPrerequisites: ["equivalent expressions", "multiplication structure"],
      lessons: [
        { lessonId: "g10-common-factor-review", title: "Common Factor Review", objective: "Factor out the greatest common factor in expressions.", conceptTags: ["greatest common factor", "factoring"], skillTags: ["factoring expressions", "checking structure"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-factoring-simple-quadratics", title: "Factoring Simple Quadratic Forms", objective: "Factor simple quadratic expressions where possible.", conceptTags: ["quadratic factoring", "algebraic structure"], skillTags: ["factoring quadratics", "testing factors"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-structure-based-reasoning", title: "Structure-Based Algebraic Reasoning", objective: "Use algebraic structure to choose an efficient rewriting strategy.", conceptTags: ["structure", "rewriting strategy"], skillTags: ["choosing strategies", "justifying algebra"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-quadratic-foundations",
      unitTitle: "Quadratic Foundations",
      unitObjectives: ["Recognize quadratic forms.", "Interpret quadratic patterns before formal graphing."],
      unitPrerequisites: ["factoring basics", "pattern reasoning"],
      lessons: [
        { lessonId: "g10-recognizing-quadratic-growth", title: "Recognizing Quadratic Growth", objective: "Identify simple quadratic growth patterns.", conceptTags: ["quadratic growth", "second differences"], skillTags: ["recognizing patterns", "comparing growth"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-quadratic-expressions-in-context", title: "Quadratic Expressions in Context", objective: "Interpret simple quadratic expressions in context.", conceptTags: ["quadratic expressions", "context interpretation"], skillTags: ["interpreting expressions", "connecting forms to meaning"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-quadratic-exam-style-reasoning", title: "Quadratic Exam-Style Reasoning", objective: "Reason through exam-style quadratic questions using structure and pattern.", conceptTags: ["quadratic reasoning", "exam-style tasks"], skillTags: ["exam problem solving", "explaining structure"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
    {
      unitId: "math-g10-exam-strategy-and-modeling",
      unitTitle: "Exam Strategy and Mathematical Modeling",
      unitObjectives: ["Apply ratio and algebra reasoning in exam-style tasks.", "Model real situations with equations and interpretation."],
      unitPrerequisites: ["ratio and algebra foundations", "multi-step reasoning"],
      lessons: [
        { lessonId: "g10-reading-exam-prompts", title: "Reading Exam Prompts Carefully", objective: "Identify what an exam-style math prompt is asking before solving.", conceptTags: ["exam prompts", "problem interpretation"], skillTags: ["interpreting questions", "planning solutions"], targetDifficulty: "intro" as const, masteryLevel: "emerging" as const, lessonType: "intro" as const },
        { lessonId: "g10-modeling-with-equations", title: "Modeling with Equations", objective: "Model real situations using equations and proportional reasoning.", conceptTags: ["mathematical modeling", "equation choice"], skillTags: ["modeling contexts", "choosing representations"], targetDifficulty: "standard" as const, masteryLevel: "secure" as const, lessonType: "core" as const },
        { lessonId: "g10-exam-style-multi-step-problems", title: "Exam-Style Multi-Step Problems", objective: "Solve multi-step exam-style problems with clear working.", conceptTags: ["multi-step exam reasoning", "clear working"], skillTags: ["exam strategy", "explaining working"], targetDifficulty: "advanced" as const, masteryLevel: "advanced" as const, lessonType: "assessment" as const },
      ],
    },
  ] as const;

  return unitSpecs.map((spec) => {
    const lessons = spec.lessons.map((lesson, index, allLessons) =>
      createStructuredLessonSeed({
        ...lesson,
        prerequisites:
          lesson.prerequisites ??
          (index === 0
            ? [
                spec.unitPrerequisites.find(
                  (prerequisite) =>
                    prerequisite.trim().toLowerCase() !== lesson.conceptTags[0].trim().toLowerCase()
                ) ?? "mathematics readiness"
              ]
            : [allLessons[index - 1].conceptTags[0]]),
        unlocks:
          lesson.unlocks ??
          (index < allLessons.length - 1
            ? [allLessons[index + 1].conceptTags[0]]
            : [`${lesson.conceptTags[0]} application`]),
        unitTitle: spec.unitTitle,
        subjectLabel: "Mathematics",
        guardianLoadLevel: index === 2 ? "medium" : "low",
        labExposure:
          spec.unitId === "math-g10-ratio-proportional-reasoning" && index === 1
            ? "supporting"
            : "none",
        simulationExposure: false,
        realWorldApplication: "pricing, planning, transport, or resource decisions in school and community settings",
        careerConnection: "business, engineering, logistics, and technical roles use this reasoning regularly",
        digitalConnection: "spreadsheets, graph tools, or calculator checks can reinforce the same structure",
        weicTags: ["W", "I", "E"],
      })
    );

    return {
      unitId: spec.unitId,
      subject: "MATH",
      gradeLevel: 10,
      coverage: "full" as const,
      unitTitle: spec.unitTitle,
      unitObjectives: [...spec.unitObjectives],
      unitPrerequisites: [...spec.unitPrerequisites],
      assessmentPlan: {
        quickChecks: [`State the key idea behind ${spec.lessons[0].conceptTags[0]}.`],
        practiceQuestions: [
          `Solve one task from ${spec.lessons[1].title}.`,
          `Explain one strategy from ${spec.lessons[2].title}.`,
        ],
        remediationTasks: [`Return to the core worked example from ${spec.lessons[1].title} and narrate the reasoning.`],
        challengeTasks: [`Apply ${spec.lessons[2].conceptTags[0]} in a new exam-style situation.`],
        unitTestFocus: spec.lessons.map((lesson) => lesson.title),
      },
      lessons,
    } satisfies UnitSeed;
  });
}

const CURATED_UNIT_SEEDS: UnitSeed[] = [
  {
    unitId: "math-g7-fractions-ratios",
    subject: "MATH",
    gradeLevel: 7,
    coverage: "full",
    unitTitle: "Fractions and Ratio Reasoning",
    unitObjectives: [
      "Compare, order, and explain fractions with visual and symbolic methods.",
      "Use ratio language and tables to solve everyday proportion problems.",
    ],
    unitPrerequisites: [
      "Recognize halves, thirds, fourths, and simple equivalent fractions.",
      "Interpret multiplication and division with whole numbers.",
    ],
    assessmentPlan: {
      quickChecks: [
        "Choose which fraction is greater and justify the method.",
        "Interpret a ratio statement from a classroom context.",
      ],
      practiceQuestions: [
        "Compare two unlike fractions using benchmarks.",
        "Represent a ratio with words, symbols, and a table.",
      ],
      remediationTasks: [
        "Rebuild the comparison with fraction strips and sentence frames.",
      ],
      challengeTasks: [
        "Solve a multi-step ratio problem involving scale or budgeting.",
      ],
      unitTestFocus: [
        "Fraction comparison with evidence",
        "Equivalent fraction reasoning",
        "Ratio table problem solving",
      ],
    },
    lessons: [
      {
        lessonId: "equivalent-fractions-foundations",
        title: "Understanding Equivalent Fractions",
        objective: "Use fraction models to explain why different fractions can represent the same amount.",
        targetDifficulty: "intro",
        masteryLevel: "emerging",
        conceptTags: ["equivalent fractions", "fraction models", "same whole"],
        skillTags: ["representing fractions", "explaining reasoning"],
        prerequisites: ["whole-part relationships", "equal partitioning"],
        unlocks: ["fraction comparison", "common denominator strategy"],
        lessonOpeningRoutine: "Display two shaded bars and ask learners whether they show the same amount and why.",
        classroomActivities: [
          "Fold paper strips into halves, fourths, and eighths to match equal amounts.",
          "Build a class chart of equivalent fractions using symbols and visuals.",
        ],
        groupWorkTask: "Pairs create one visual proof that two fractions are equivalent and present the proof sentence.",
        projectTask: "Create a fraction poster showing three equivalent forms for one classroom-sharing situation.",
        pacingGuidance: "Spend 10 minutes on concrete models, 15 on explanation, and 15 on guided reasoning.",
        materialsNeeded: ["paper strips", "markers", "exercise books"],
        differentiationNotes: [
          "Start some learners with halves and fourths before extending to eighths.",
          "Ask confident learners to generate a rule for building equivalent fractions.",
        ],
        commonMisconceptions: [
          "Learners think larger denominators always mean larger fractions.",
          "Learners compare pieces without keeping the whole equal.",
        ],
        explanation: "Equivalent fractions represent the same amount when the whole is the same size. Learners can see this by folding equal strips into different numbers of equal parts and matching the shaded amount.",
        workedExamples: [
          "Show that 1/2 equals 2/4 by folding the same strip once and then twice.",
          "Show that 3/4 equals 6/8 by splitting each fourth into two equal parts.",
        ],
        guidedPractice: [
          "Use a drawing to show why 2/3 and 4/6 are equivalent.",
          "Complete: 3/5 = __/10 and explain the pattern.",
        ],
        independentPractice: [
          "Write two equivalent fractions for 2/7 and explain one method.",
          "Circle the fractions equivalent to 3/4 from a short list.",
        ],
        quickChecks: ["Is 2/4 equal to 1/2? Explain with one sentence."],
        practiceQuestions: [
          "Find two fractions equivalent to 4/5.",
          "Explain why 5/10 and 1/2 name the same amount.",
        ],
        remediationTasks: ["Refold strips and match shaded parts before writing the symbolic pair."],
        challengeTasks: ["Explain whether 4/6 and 6/9 are equivalent and justify without drawing both first."],
        guardianSupportNote: "Ask your child to show one fraction with paper folding and explain how a second fraction can name the same amount.",
        homePracticeSuggestion: "Fold a page or food portion into equal parts and ask your child to name equivalent shares.",
        whatToLookFor: "Listen for the idea that the whole must stay the same.",
        simplifiedInstructions: "Use one strip, fold it two ways, and ask your child which shaded parts match.",
        noMaterialVariant: "Draw one rectangle and divide it in different ways instead of folding paper.",
        voiceFriendlyScript: "Tell me how one half can also be called two fourths when the whole does not change.",
        guardianLoadLevel: "low",
        realWorldApplication: "Equivalent fractions help when sharing food fairly and reading measurements.",
        careerConnection: "Tailors, cooks, and builders use equal-part reasoning when measuring.",
        digitalConnection: "A fraction bar visualizer can confirm the same amount with different partitions.",
        discussionPrompt: "Why must the whole stay the same when we compare fractions?",
        teacherNotes: "Keep concrete models visible through the first worked example.",
        lessonType: "intro",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["W", "I"],
      },
      {
        lessonId: "comparing-fractions-benchmarks",
        title: "Comparing Fractions with Benchmarks",
        objective: "Compare fractions using benchmarks, common denominators, and visual models.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["fraction comparison", "benchmarks", "common denominators"],
        skillTags: ["comparing fractions", "justifying answers"],
        prerequisites: ["equivalent fractions", "fraction size"],
        unlocks: ["ordering fractions", "ratio interpretation"],
        lessonOpeningRoutine: "Pose a hinge question: which is greater, 5/8 or 3/4, and how do you know?",
        classroomActivities: [
          "Place fraction cards relative to one-half and one whole on a number line.",
          "Compare unlike fractions with strip models before converting to common denominators.",
        ],
        groupWorkTask: "Teams solve three comparison cards and defend one method they chose.",
        projectTask: "Create a market poster comparing food portions with at least three unlike fractions.",
        pacingGuidance: "Protect time for both visual comparison and symbolic comparison before independent work.",
        materialsNeeded: ["paper strips", "fraction cards", "board"],
        differentiationNotes: [
          "Provide benchmark sentence frames for learners who need structure.",
          "Invite advanced learners to compare mentally before drawing.",
        ],
        commonMisconceptions: [
          "Learners compare denominators only.",
          "Learners forget to consider the same whole.",
        ],
        explanation: "Fractions can be compared by checking their distance from known benchmarks like one-half and one whole, or by rewriting them with common denominators when needed.",
        workedExamples: [
          "Compare 3/4 and 5/8 by converting to eighths: 6/8 is greater than 5/8.",
          "Compare 2/5 and 1/2 by reasoning that 2/5 is less than one-half.",
        ],
        guidedPractice: [
          "Compare 2/3 and 3/5 using one benchmark strategy.",
          "Compare 7/10 and 5/6 and name the method used.",
        ],
        independentPractice: [
          "Order 1/2, 3/4, and 5/8 from least to greatest.",
          "Explain which is greater: 4/9 or 5/12.",
        ],
        quickChecks: ["Which is greater, 4/5 or 7/10? State one reason."],
        practiceQuestions: [
          "Compare 5/6 and 7/9.",
          "Compare 3/8 and 1/2 using a benchmark.",
        ],
        remediationTasks: ["Use benchmark cards labeled less than one-half, equal to one-half, and greater than one-half."],
        challengeTasks: ["Explain two different ways to compare 7/12 and 5/8."],
        guardianSupportNote: "Ask your child to compare two fractions and explain whether each one is less than or greater than one-half.",
        homePracticeSuggestion: "Compare food portions such as half a loaf and three fourths of a loaf using words first.",
        whatToLookFor: "Students should explain the method, not just the answer.",
        simplifiedInstructions: "Ask which fraction is closer to one whole and why.",
        noMaterialVariant: "Draw two bars and label each fraction if there are no strips.",
        voiceFriendlyScript: "Explain which fraction is larger and tell me the clue you used.",
        guardianLoadLevel: "low",
        realWorldApplication: "Fraction comparison supports fair sharing, recipes, and budgeting.",
        careerConnection: "Vendors and technicians compare portions and quantities accurately.",
        digitalConnection: "A fraction bar visualizer can show the size difference quickly.",
        discussionPrompt: "When is a benchmark faster than converting to common denominators?",
        teacherNotes: "This is the core lab lesson for the unit; require verbal reasoning after the hands-on comparison.",
        lessonType: "core",
        labExposure: "core",
        simulationExposure: true,
        weicTags: ["W", "I", "C"],
      },
      {
        lessonId: "adding-fractions-like-denominators",
        title: "Adding Fractions with Like Denominators",
        objective: "Add fractions with like denominators and interpret the sum in context.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["fraction addition", "like denominators", "whole-part interpretation"],
        skillTags: ["adding fractions", "interpreting sums"],
        prerequisites: ["fraction size", "equivalent fractions"],
        unlocks: ["multi-step fraction problems", "ratio tables"],
        lessonOpeningRoutine: "Review one equivalent fraction from the previous lesson, then connect it to adding same-sized parts.",
        classroomActivities: [
          "Shade combined parts on one bar model before writing the symbolic sum.",
          "Solve two short story problems with partners and match each to a diagram.",
        ],
        groupWorkTask: "Groups choose a story context and model the fraction sum on chart paper.",
        projectTask: "Design a snack-sharing problem that requires adding two fractions with the same denominator.",
        pacingGuidance: "Model one full example, then move quickly to guided and independent practice.",
        materialsNeeded: ["exercise books", "fraction bars", "board"],
        differentiationNotes: [
          "Keep some learners on unit fractions first.",
          "Extend stronger learners to sums greater than one whole.",
        ],
        commonMisconceptions: [
          "Learners add denominators as well as numerators.",
          "Learners forget to interpret an improper fraction result.",
        ],
        explanation: "When denominators are the same, the parts are the same size, so we add the numerators and keep the denominator to show how many equal parts are combined.",
        workedExamples: [
          "2/8 + 3/8 = 5/8 because the parts are both eighths.",
          "5/6 + 2/6 = 7/6, which is more than one whole.",
        ],
        guidedPractice: [
          "Add 1/5 + 3/5 and explain the denominator.",
          "Add 4/7 + 2/7 using a diagram.",
        ],
        independentPractice: [
          "Solve 3/10 + 4/10 and write one sentence about the result.",
          "Solve a word problem involving 2/9 and 5/9 of a journey.",
        ],
        quickChecks: ["Why does the denominator stay the same in 2/9 + 4/9?"],
        practiceQuestions: ["Add 3/8 + 2/8.", "Add 5/12 + 4/12."],
        remediationTasks: ["Return to the bar model and count combined equal parts aloud."],
        challengeTasks: ["Solve 7/8 + 5/8 and express the result as a mixed number."],
        guardianSupportNote: "Ask your child to explain why same denominators mean the parts are the same size.",
        homePracticeSuggestion: "Use grouped food pieces or bottle caps to show two same-sized fractional parts being combined.",
        whatToLookFor: "Students should keep the denominator unchanged when parts are the same size.",
        simplifiedInstructions: "Ask your child to add the top numbers and keep the bottom number the same.",
        noMaterialVariant: "Use a single drawing divided into equal parts if no objects are available.",
        voiceFriendlyScript: "Tell me why the denominator stays the same when the parts are equal in size.",
        guardianLoadLevel: "low",
        realWorldApplication: "Combining same-sized parts matters in measuring ingredients and shared tasks.",
        careerConnection: "Cooks and builders combine equal units accurately.",
        digitalConnection: "A simple board or digital bar model can show the combined parts clearly.",
        discussionPrompt: "How do you know when a fraction sum is greater than one whole?",
        teacherNotes: "Keep this lesson free of extra lab attachments so practice time stays high.",
        lessonType: "practice",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["W", "I"],
      },
      {
        lessonId: "introducing-ratios-everyday-contexts",
        title: "Introducing Ratios in Everyday Contexts",
        objective: "Describe and interpret ratios using classroom, market, and transport examples.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["ratios", "part-to-part", "part-to-whole"],
        skillTags: ["describing ratios", "reading ratio language"],
        prerequisites: ["multiplicative comparison", "fraction reasoning"],
        unlocks: ["ratio tables", "proportion problems"],
        lessonOpeningRoutine: "Show a tray with colored counters and ask for two different ways to describe the relationship.",
        classroomActivities: [
          "Sort classroom objects and write ratios in words and symbols.",
          "Match ratio statements to simple tables and pictures.",
        ],
        groupWorkTask: "Groups build one Liberia-relevant ratio example from market or transport data and explain the wording.",
        projectTask: "Create a ratio card that includes a picture, a written ratio, and one interpretation sentence.",
        pacingGuidance: "Use concrete examples first, then move to symbolic notation before practice sets.",
        materialsNeeded: ["bottle caps", "counter cards", "exercise books"],
        differentiationNotes: [
          "Keep some learners on part-to-part language before part-to-whole.",
          "Ask stronger learners to write equivalent ratios from the same context.",
        ],
        commonMisconceptions: [
          "Learners reverse the order of terms in a ratio statement.",
          "Learners confuse ratio with subtraction difference.",
        ],
        explanation: "A ratio compares two quantities and tells how much of one quantity there is for another in the same context.",
        workedExamples: [
          "If there are 6 girls and 3 boys, the ratio of girls to boys is 6:3.",
          "If 4 of 10 counters are red, the ratio of red counters to all counters is 4:10.",
        ],
        guidedPractice: [
          "Write the ratio of pencils to books in a pictured set.",
          "Interpret the ratio 3:5 in a transport-seat context.",
        ],
        independentPractice: [
          "Write two ratio statements from a simple classroom picture.",
          "Decide whether a ratio is part-to-part or part-to-whole.",
        ],
        quickChecks: ["In 2:7, what is being compared if the context is buses and taxis?"],
        practiceQuestions: ["Write a ratio from 8 blue beads and 4 white beads.", "Interpret 5:12 in words."],
        remediationTasks: ["Use objects and sentence frames: 'For every __, there are __.'"],
        challengeTasks: ["Write an equivalent ratio for 6:9 and explain how you know."],
        guardianSupportNote: "Ask your child to describe a simple home ratio, such as cups to plates, using 'for every'.",
        homePracticeSuggestion: "Count two sets of household items and say the ratio in words first, then symbols.",
        whatToLookFor: "Students should keep the order of the ratio consistent with the words used.",
        simplifiedInstructions: "Ask, 'For every how many of one thing, how many of the other thing are there?'",
        noMaterialVariant: "Use imagined objects or a short oral scenario if there are no items nearby.",
        voiceFriendlyScript: "Tell me a ratio from our home and say it with the words 'for every'.",
        guardianLoadLevel: "low",
        realWorldApplication: "Ratios help compare prices, ingredients, and transport groupings.",
        careerConnection: "Traders, cooks, and logistics workers use ratios to plan quantities.",
        digitalConnection: "A simple slider or table can show how ratios scale up and down.",
        discussionPrompt: "How does the wording change the meaning of a ratio?",
        teacherNotes: "Use this as the supporting lab lesson with concrete objects before moving to tables.",
        lessonType: "core",
        labExposure: "supporting",
        simulationExposure: false,
        weicTags: ["W", "E", "C"],
      },
      {
        lessonId: "solving-ratio-problems-with-tables",
        title: "Solving Ratio Problems with Tables",
        objective: "Use ratio tables to solve proportional problems and explain the scale factor used.",
        targetDifficulty: "advanced",
        masteryLevel: "advanced",
        conceptTags: ["ratio tables", "scale factor", "proportional reasoning"],
        skillTags: ["solving ratio problems", "using tables"],
        prerequisites: ["ratio language", "multiplicative reasoning"],
        unlocks: ["proportional graphs", "scale problems"],
        lessonOpeningRoutine: "Review one simple ratio and ask how it changes if every quantity doubles.",
        classroomActivities: [
          "Build ratio tables from market price examples and scale them up.",
          "Compare two strategies for reaching a missing value in the table.",
        ],
        groupWorkTask: "Groups solve one transport or supply ratio table and present the scale factor used.",
        projectTask: "Plan supplies for a class event using a ratio table and justify the final totals.",
        pacingGuidance: "Keep the opening brief and reserve time for challenge tasks and explanation.",
        materialsNeeded: ["exercise books", "ratio table templates", "board"],
        differentiationNotes: [
          "Provide half-completed tables for learners who need support.",
          "Extend advanced learners to non-unit scale factors.",
        ],
        commonMisconceptions: [
          "Learners add instead of multiply across the ratio table.",
          "Learners scale one column but not the matching column.",
        ],
        explanation: "A ratio table keeps equivalent ratios aligned so learners can multiply or divide both quantities by the same factor to find missing values.",
        workedExamples: [
          "If 2 notebooks cost 10 dollars, then 6 notebooks cost 30 dollars because both values are multiplied by 3.",
          "If 3 cups of rice serve 6 people, then 5 cups serve 10 people when the scale factor is consistent.",
        ],
        guidedPractice: [
          "Complete a table for 4 mangoes costing 20 dollars and 12 mangoes costing __.",
          "Explain the factor used in a ratio table that moves from 3:7 to 9:21.",
        ],
        independentPractice: [
          "Solve a fuel or fare table problem.",
          "Explain why one completed table is incorrect and fix it.",
        ],
        quickChecks: ["What factor changes 4:6 into 12:18?"],
        practiceQuestions: ["Complete a table for 5 items costing 15 dollars.", "Scale 2:3 to 10:15."],
        remediationTasks: ["Use arrows on both columns to show the same multiplication factor."],
        challengeTasks: ["Solve a two-step ratio table involving halving and doubling."],
        guardianSupportNote: "Ask your child how a ratio table helps keep two quantities growing at the same rate.",
        homePracticeSuggestion: "Use a buying or cooking example and ask your child to scale it for more people.",
        whatToLookFor: "Students should apply the same factor to both quantities.",
        simplifiedInstructions: "Ask, 'What number did you multiply both parts by?'",
        noMaterialVariant: "Draw a two-column table and use one oral example.",
        voiceFriendlyScript: "Explain how you keep both parts of the ratio balanced when the amount grows.",
        guardianLoadLevel: "medium",
        realWorldApplication: "Ratio tables help scale ingredients, prices, and travel plans accurately.",
        careerConnection: "Entrepreneurs and logistics planners use proportional tables to plan resources.",
        digitalConnection: "A digital table or spreadsheet can scale values quickly while keeping the ratio aligned.",
        discussionPrompt: "Why is multiplication more reliable than repeated addition in some ratio tables?",
        teacherNotes: "Treat this as the unit capstone and link back to fraction comparison and ratio language.",
        lessonType: "assessment",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["W", "E", "I"],
      },
    ],
  },
  {
    unitId: "science-g5-plants-light-food",
    subject: "SCIENCE",
    gradeLevel: 5,
    coverage: "full",
    unitTitle: "Plants, Light, and Food Making",
    unitObjectives: [
      "Explain how plants use light, water, and air to make food and grow.",
      "Use observation and evidence to describe how changing conditions affect plant health.",
    ],
    unitPrerequisites: [
      "Recognize basic plant parts and their functions.",
      "Describe observable differences in living things.",
    ],
    assessmentPlan: {
      quickChecks: [
        "Explain one condition plants need and why it matters.",
        "Interpret a simple change in plant growth conditions.",
      ],
      practiceQuestions: [
        "Describe what happens when a plant receives less light.",
        "Use evidence from an observation to explain plant change.",
      ],
      remediationTasks: ["Use plant diagrams and sentence frames to restate the process of food making."],
      challengeTasks: ["Predict how two changed conditions would affect growth and justify the prediction."],
      unitTestFocus: [
        "Plant needs and photosynthesis",
        "Observation-based explanation",
        "Variable change and plant growth",
      ],
    },
    lessons: [
      {
        lessonId: "plant-parts-and-jobs",
        title: "Plant Parts and Their Jobs",
        objective: "Identify major plant parts and explain how each supports plant survival.",
        targetDifficulty: "intro",
        masteryLevel: "emerging",
        conceptTags: ["plant parts", "roots", "leaves", "stems"],
        skillTags: ["identifying structures", "explaining function"],
        prerequisites: ["observing living things", "naming common plants"],
        unlocks: ["plant needs", "photosynthesis"],
        lessonOpeningRoutine: "Display a simple plant sketch and ask what each part does.",
        classroomActivities: [
          "Label a class diagram of roots, stems, leaves, and flowers.",
          "Match each part to its job using cards and oral reasoning.",
        ],
        groupWorkTask: "Groups build a function chart linking each plant part to one survival role.",
        projectTask: "Create a labeled plant poster with one local crop example.",
        pacingGuidance: "Keep the explanation short and reserve time for students to speak about function.",
        materialsNeeded: ["plant sample or picture", "chart paper", "exercise books"],
        differentiationNotes: [
          "Use picture prompts for emerging readers.",
          "Ask stronger learners to compare two plant types.",
        ],
        commonMisconceptions: [
          "Learners think leaves only decorate the plant.",
          "Learners confuse roots with stems.",
        ],
        explanation: "Each plant part has a job. Roots take in water, stems support and transport, leaves help make food, and flowers support reproduction.",
        workedExamples: [
          "Explain why roots are important after heavy rain or dry weather.",
          "Show how stems hold leaves where they can receive light.",
        ],
        guidedPractice: ["Match each plant part to its function.", "Explain why leaves need light."],
        independentPractice: ["Label a plant diagram.", "Write one sentence about how roots help the plant."],
        quickChecks: ["Which plant part helps take in water from the soil?"],
        practiceQuestions: ["What is one job of the stem?", "Why are leaves important?"],
        remediationTasks: ["Use a picture card sort with fewer labels and oral explanation."],
        challengeTasks: ["Explain how two plant parts work together to support growth."],
        guardianSupportNote: "Ask your child to point out one part of a local plant and say what job it does.",
        homePracticeSuggestion: "Observe a plant near home and name one visible part and its job.",
        whatToLookFor: "Students should connect structure to function, not just name parts.",
        simplifiedInstructions: "Ask, 'What does this part help the plant do?'",
        noMaterialVariant: "Use a drawn plant if no live sample is available.",
        voiceFriendlyScript: "Tell me one part of the plant and the job it does for the whole plant.",
        guardianLoadLevel: "low",
        realWorldApplication: "Knowing plant structure helps with farming and caring for home gardens.",
        careerConnection: "Farmers and agricultural technicians use plant-part knowledge every day.",
        digitalConnection: "A simple plant diagram can highlight each part with a label and note.",
        discussionPrompt: "Which plant part becomes most important in dry conditions and why?",
        teacherNotes: "Use local crops where possible to keep the lesson grounded.",
        lessonType: "intro",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["W", "C"],
      },
      {
        lessonId: "conditions-plants-need",
        title: "Conditions Plants Need to Grow",
        objective: "Explain how light, water, and air support plant growth.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["plant needs", "light", "water", "air"],
        skillTags: ["explaining growth conditions", "using evidence"],
        prerequisites: ["plant parts", "observing change"],
        unlocks: ["photosynthesis", "variable investigations"],
        lessonOpeningRoutine: "Ask what would happen if a plant had water but no light.",
        classroomActivities: [
          "Sort plant-growth scenarios into strong and weak conditions.",
          "Describe how changing one condition affects the plant.",
        ],
        groupWorkTask: "Groups explain one poor-growth scenario using the sentence frame 'The plant struggles because...'.",
        projectTask: "Build a simple care guide for one classroom plant using the key conditions.",
        pacingGuidance: "Use oral prediction, then move to short evidence-based explanation.",
        materialsNeeded: ["plant pictures", "condition cards", "exercise books"],
        differentiationNotes: ["Keep vocabulary visible on the board.", "Invite advanced learners to compare two weak conditions."],
        commonMisconceptions: ["Learners think soil is plant food.", "Learners ignore the role of air."],
        explanation: "Plants need light, water, and air to grow well. If one condition is weak, plant growth becomes weaker because the plant cannot make food or stay healthy.",
        workedExamples: [
          "A plant near a bright window usually grows stronger than one in deep shade.",
          "A plant without enough water may droop or stop growing well.",
        ],
        guidedPractice: ["Explain what happens when light is reduced.", "Explain what happens when water is reduced."],
        independentPractice: ["Write one sentence about why air matters to plants.", "Choose the best growing condition from a short set of pictures."],
        quickChecks: ["Name two conditions plants need to grow well."],
        practiceQuestions: ["Why is light important?", "What could happen if a plant has no water for many days?"],
        remediationTasks: ["Use a three-column chart labeled light, water, and air with one example in each."],
        challengeTasks: ["Explain which missing condition would cause the quickest visible change and why."],
        guardianSupportNote: "Ask your child what a plant near home needs most to stay healthy and why.",
        homePracticeSuggestion: "Observe one plant at home and talk about its light and water conditions.",
        whatToLookFor: "Students should connect each condition to plant health clearly.",
        simplifiedInstructions: "Ask, 'What does the plant need, and what happens if it does not get it?'",
        noMaterialVariant: "Use one spoken scenario and ask your child to predict the result.",
        voiceFriendlyScript: "Tell me what a plant needs every day to stay healthy and grow.",
        guardianLoadLevel: "low",
        realWorldApplication: "Plant care matters in home gardens, farms, and community food systems.",
        careerConnection: "Farmers use growth conditions to improve crop yield.",
        digitalConnection: "A simple slider can show how plant growth changes as light or water changes.",
        discussionPrompt: "Which condition would be hardest to replace if it were missing?",
        teacherNotes: "Use this lesson to prepare students for the photosynthesis core investigation.",
        lessonType: "core",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["W", "C"],
      },
      {
        lessonId: "photosynthesis-food-making",
        title: "How Plants Make Food",
        objective: "Explain that plants make food using light, water, and air.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["photosynthesis", "plant food", "light and water"],
        skillTags: ["explaining processes", "using observations"],
        prerequisites: ["plant needs", "leaf function"],
        unlocks: ["variable change reasoning", "growth prediction"],
        lessonOpeningRoutine: "Show a leaf and ask how it helps the plant grow stronger.",
        classroomActivities: [
          "Observe plant examples and connect each condition to the food-making process.",
          "Build a simple input-output chart for light, water, air, and plant growth.",
        ],
        groupWorkTask: "Groups explain photosynthesis using arrows and one evidence statement from the observation task.",
        projectTask: "Create a classroom explanation chart showing what goes into plant food making and what comes out.",
        pacingGuidance: "Use the observation task early, then move to explanation and short writing.",
        materialsNeeded: ["leaf samples", "chart paper", "water", "exercise books"],
        differentiationNotes: ["Keep the explanation concrete and avoid overloading vocabulary.", "Ask confident learners to explain what changes when light is reduced."],
        commonMisconceptions: ["Learners think soil is the plant's food.", "Learners think sunlight is the food itself."],
        explanation: "Plants make food mainly in their leaves. They use light, water, and air to support this process, which helps them grow and stay healthy.",
        workedExamples: [
          "Explain why a plant in light usually stays greener than one kept in darkness.",
          "Show how light and water support food making together.",
        ],
        guidedPractice: ["Name the main things a plant needs to make food.", "Explain why leaves matter in photosynthesis."],
        independentPractice: ["Write a short explanation of how plants make food.", "Match each input to its role in the process."],
        quickChecks: ["What does a plant use to make food?"],
        practiceQuestions: ["Why are leaves important in photosynthesis?", "What could happen if light is missing?"],
        remediationTasks: ["Use a visual input-output organizer and repeat the explanation with sentence starters."],
        challengeTasks: ["Explain why two plants with the same water might still grow differently."],
        guardianSupportNote: "Ask your child to explain in simple words how a plant uses light and water to make food.",
        homePracticeSuggestion: "Observe a plant near light and ask your child to explain why the leaves matter.",
        whatToLookFor: "Students should say that plants make food rather than take food from the soil.",
        simplifiedInstructions: "Ask, 'How does the plant make its own food?'",
        noMaterialVariant: "Use a leaf drawing and a simple talk-through if no plant sample is available.",
        voiceFriendlyScript: "Tell me what a plant needs in order to make food and grow.",
        guardianLoadLevel: "low",
        realWorldApplication: "Understanding photosynthesis helps families and communities care for crops.",
        careerConnection: "Agriculture and environmental work depend on strong plant-growth understanding.",
        digitalConnection: "A plant growth slider can show how changed light or water affects outcomes.",
        discussionPrompt: "Why does light matter even when the plant already has water?",
        teacherNotes: "This is the core investigation lesson; keep the pseudo lab and slider visible only here.",
        lessonType: "core",
        labExposure: "core",
        simulationExposure: true,
        weicTags: ["W", "I", "C"],
      },
      {
        lessonId: "testing-growth-variables",
        title: "Testing Growth Variables",
        objective: "Use observations to explain how changing one plant-growth variable affects the result.",
        targetDifficulty: "advanced",
        masteryLevel: "advanced",
        conceptTags: ["variables", "fair test", "plant growth"],
        skillTags: ["predicting outcomes", "interpreting evidence"],
        prerequisites: ["photosynthesis", "plant needs"],
        unlocks: ["evidence-based explanation", "environmental systems"],
        lessonOpeningRoutine: "Ask which is a fairer comparison: changing one condition or changing two at once.",
        classroomActivities: [
          "Compare two plant-growth scenarios and identify the one changed variable.",
          "Record one prediction and one observation sentence for each scenario.",
        ],
        groupWorkTask: "Groups analyze a simple light-versus-water change and report which variable caused the difference.",
        projectTask: "Design a short plant observation plan that changes only one condition.",
        pacingGuidance: "Use one clear scenario at a time and push learners to justify with evidence.",
        materialsNeeded: ["scenario cards", "exercise books", "chart paper"],
        differentiationNotes: ["Provide a table for observations and explanations.", "Ask stronger learners to critique an unfair test."],
        commonMisconceptions: ["Learners change more than one condition at once.", "Learners state outcomes without linking them to evidence."],
        explanation: "A fair investigation changes one condition at a time so learners can explain which variable affected the plant's growth.",
        workedExamples: [
          "Compare two plants where only the light level changes.",
          "Explain why a test that changes light and water together is harder to interpret.",
        ],
        guidedPractice: ["Identify the changed variable in two scenarios.", "Explain the likely outcome if only water is reduced."],
        independentPractice: ["Write one prediction for a changed light condition.", "Explain whether a test is fair or not."],
        quickChecks: ["What makes a plant test fair?"],
        practiceQuestions: ["What happens when only light is reduced?", "Why should one condition change at a time?"],
        remediationTasks: ["Use a two-column chart: what changed and what happened."],
        challengeTasks: ["Design an improved fair test from a flawed example."],
        guardianSupportNote: "Ask your child to explain why changing one condition at a time makes an investigation clearer.",
        homePracticeSuggestion: "Talk through one simple plant-change scenario and predict the result together.",
        whatToLookFor: "Students should name the changed variable clearly.",
        simplifiedInstructions: "Ask, 'What one thing changed, and what happened because of it?'",
        noMaterialVariant: "Use two spoken scenarios and compare them orally.",
        voiceFriendlyScript: "Tell me why changing only one thing helps us learn what caused the difference.",
        guardianLoadLevel: "medium",
        realWorldApplication: "Testing one condition at a time helps farmers and gardeners improve growth decisions.",
        careerConnection: "Agricultural researchers and technicians use fair testing to improve crops.",
        digitalConnection: "The plant growth slider reinforces how one variable changes the result.",
        discussionPrompt: "Why is a fair test more useful than a confusing test?",
        teacherNotes: "Treat this as a supporting lab lesson using observation and explanation rather than extra materials.",
        lessonType: "practice",
        labExposure: "supporting",
        simulationExposure: true,
        weicTags: ["W", "I"],
      },
      {
        lessonId: "water-cycle-supports-plant-life",
        title: "Water Cycle and Plant Growth",
        objective: "Describe how evaporation and condensation connect to water availability for plants.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["water cycle", "evaporation", "condensation", "plant growth"],
        skillTags: ["sequencing processes", "connecting systems"],
        prerequisites: ["plant needs", "water as a growth condition"],
        unlocks: ["environmental systems", "seasonal change reasoning"],
        lessonOpeningRoutine: "Ask where rainwater that feeds plants comes from before it falls.",
        classroomActivities: [
          "Sequence the main stages of the water cycle.",
          "Connect each stage to how plants receive water over time.",
        ],
        groupWorkTask: "Teams build a simple sequence chart and explain how the cycle supports crops.",
        projectTask: "Create a weather-to-plant map showing how rain supports plant growth in the community.",
        pacingGuidance: "Use the sequence task as the main activity and keep the explanation concrete.",
        materialsNeeded: ["clear cup", "water", "chart paper"],
        differentiationNotes: ["Use pictures to support the sequence.", "Ask advanced learners to connect the cycle to seasonal farming patterns."],
        commonMisconceptions: ["Learners think droplets appear from nowhere.", "Learners confuse evaporation with condensation."],
        explanation: "Water moves through evaporation, condensation, and collection. This cycle helps return water to the environment so plants can keep receiving one of the conditions they need for growth.",
        workedExamples: [
          "Explain how evaporated water later returns as rain.",
          "Connect rainfall to the water available for plant roots.",
        ],
        guidedPractice: ["Order the stages: evaporation, condensation, collection.", "Explain one way the cycle supports plants."],
        independentPractice: ["Draw the sequence and label each stage.", "Write one sentence linking rain to plant growth."],
        quickChecks: ["Which stage forms cloud droplets?"],
        practiceQuestions: ["What is evaporation?", "How does rain help plants?"],
        remediationTasks: ["Use a three-stage picture strip and oral retelling."],
        challengeTasks: ["Explain how a long dry period might affect the cycle's support for crops."],
        guardianSupportNote: "Ask your child to explain how water returns as rain and why that matters for plants.",
        homePracticeSuggestion: "Use a cup of water near a window and ask your child to talk through the changes they imagine in the wider environment.",
        whatToLookFor: "Students should connect the cycle to water availability for plants.",
        simplifiedInstructions: "Ask, 'How does water leave, return, and help plants again?'",
        noMaterialVariant: "Use a board sequence and oral explanation if no cup model is available.",
        voiceFriendlyScript: "Tell me how water travels through the environment and helps plants grow.",
        guardianLoadLevel: "low",
        realWorldApplication: "The water cycle connects weather, farming, and community food supply.",
        careerConnection: "Environmental workers and farmers track water patterns to support crops.",
        digitalConnection: "A sequence interactive can reinforce the order of the stages.",
        discussionPrompt: "How does understanding the water cycle help us understand plant growth better?",
        teacherNotes: "Use the sequence simulation if available; otherwise keep the board model concise.",
        lessonType: "review",
        labExposure: "supporting",
        simulationExposure: true,
        weicTags: ["W", "C", "I"],
      },
    ],
  },
  {
    unitId: "literacy-g3-sequencing-retelling",
    subject: "LITERACY",
    gradeLevel: 3,
    coverage: "partial",
    unitTitle: "Sequencing and Retelling",
    unitObjectives: [
      "Retell short texts in clear order using sequence words.",
      "Identify key events and use them to support oral and written retelling.",
    ],
    unitPrerequisites: [
      "Listen to short stories and identify characters.",
      "Use simple speaking sentences with teacher support.",
    ],
    assessmentPlan: {
      quickChecks: ["Retell a three-event story in order."],
      practiceQuestions: ["What happened first, next, and last?", "Which event should not come before the others?"],
      remediationTasks: ["Use picture cards and oral rehearsal before writing."],
      challengeTasks: ["Add one fitting event to a short story sequence and justify it."],
      unitTestFocus: ["sequencing events", "retelling with sequence words"],
    },
    lessons: [
      {
        lessonId: "finding-story-order",
        title: "Finding the Order of Events",
        objective: "Identify the beginning, middle, and end of a short story.",
        targetDifficulty: "intro",
        masteryLevel: "emerging",
        conceptTags: ["story order", "beginning middle end", "sequence"],
        skillTags: ["identifying events", "oral retelling"],
        prerequisites: ["listening to stories", "naming characters"],
        unlocks: ["retelling", "sequence words"],
        lessonOpeningRoutine: "Tell a short story out of order and ask what sounds wrong.",
        classroomActivities: [
          "Sort three picture cards into beginning, middle, and end.",
          "Say the story order aloud with a partner.",
        ],
        groupWorkTask: "Small groups agree on the correct order of one short picture story.",
        projectTask: "Create a three-box comic strip showing the order of events.",
        pacingGuidance: "Keep the text short and repeat oral retelling before any writing.",
        materialsNeeded: ["picture cards", "exercise books", "pencils"],
        differentiationNotes: ["Use fewer events for learners who need support.", "Ask stronger learners to justify why an event belongs in the middle."],
        commonMisconceptions: ["Learners choose the most exciting event as first.", "Learners retell without order words."],
        explanation: "Stories happen in an order. Readers can understand a text better when they know what happened first, next, and last.",
        workedExamples: ["Model a three-event story and point to the beginning, middle, and end."],
        guidedPractice: ["Choose which picture comes first.", "Tell a partner what happens last."],
        independentPractice: ["Number three story events in order.", "Retell the three events using simple sequence words."],
        quickChecks: ["What happened first in the story?"],
        practiceQuestions: ["Which event belongs in the middle?", "How do you know what comes last?"],
        remediationTasks: ["Use two events first, then rebuild the full three-event sequence."],
        challengeTasks: ["Explain why a wrong sequence changes the story meaning."],
        guardianSupportNote: "Ask your child to tell a very short story using first, next, and last.",
        homePracticeSuggestion: "Talk through a simple home routine in order, such as washing hands before eating.",
        whatToLookFor: "Students should keep the events in a sensible order.",
        simplifiedInstructions: "Ask, 'What happened first? What happened next? What happened last?'",
        noMaterialVariant: "Use a spoken story if there are no pictures.",
        voiceFriendlyScript: "Tell me the story in order using first, next, and last.",
        guardianLoadLevel: "low",
        realWorldApplication: "Sequence helps children explain routines and instructions clearly.",
        careerConnection: "Good sequence supports clear communication in every job.",
        digitalConnection: "A simple slide or picture sequence can support retelling practice.",
        discussionPrompt: "Why does order matter in a story?",
        teacherNotes: "Keep this lesson highly oral and visual.",
        lessonType: "intro",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["C", "I"],
      },
      {
        lessonId: "retelling-with-sequence-words",
        title: "Retelling with Sequence Words",
        objective: "Retell a short story using first, next, then, and last.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["retelling", "sequence words", "oral fluency"],
        skillTags: ["oral retelling", "using signal words"],
        prerequisites: ["story order", "speaking in short sentences"],
        unlocks: ["written retelling", "summarizing"],
        lessonOpeningRoutine: "Write first, next, then, and last on the board and rehearse them aloud.",
        classroomActivities: [
          "Retell a short text with sequence cards.",
          "Match a sequence word to each event in a class story.",
        ],
        groupWorkTask: "Pairs retell the same story and check whether all sequence words are used correctly.",
        projectTask: "Create a four-box retelling strip with one sequence word in each box.",
        pacingGuidance: "Model one retelling, then move quickly to repeated student speaking.",
        materialsNeeded: ["sequence word cards", "picture strip", "exercise books"],
        differentiationNotes: ["Provide sentence starters for emerging speakers.", "Ask stronger learners to retell with more detail while staying concise."],
        commonMisconceptions: ["Learners repeat first for every event.", "Learners list events without connecting words."],
        explanation: "Sequence words help listeners follow a story clearly. They show the order of events and make retelling easier to understand.",
        workedExamples: ["Model a four-event retelling using all four sequence words."],
        guidedPractice: ["Retell the class story with a partner using the word cards.", "Choose the best sequence word for one event."],
        independentPractice: ["Write two sequence sentences from a short story.", "Retell the story orally to the teacher or partner."],
        quickChecks: ["Which word should come after 'first' in your retelling?"],
        practiceQuestions: ["Retell the second event using 'next'.", "Which word fits the final event?"],
        remediationTasks: ["Use gesture cues with each sequence word before trying the full retelling."],
        challengeTasks: ["Retell a new short story without picture support while keeping the order clear."],
        guardianSupportNote: "Ask your child to retell one short story or routine using first, next, then, and last.",
        homePracticeSuggestion: "Use one household routine to practice the sequence words aloud.",
        whatToLookFor: "Students should use sequence words correctly and keep the story clear.",
        simplifiedInstructions: "Ask your child to say the story again with first, next, then, and last.",
        noMaterialVariant: "Retell orally without cards if needed.",
        voiceFriendlyScript: "Tell me the story with the sequence words so I can follow it clearly.",
        guardianLoadLevel: "low",
        realWorldApplication: "Sequence words help children explain routines and ideas clearly to others.",
        careerConnection: "Clear step-by-step speaking matters in teaching, health work, and trades.",
        digitalConnection: "A short audio retelling can help students hear clear sequence language.",
        discussionPrompt: "Which sequence word helps the listener most, and why?",
        teacherNotes: "Attach the simple literacy support artifact only here if present.",
        lessonType: "core",
        labExposure: "supporting",
        simulationExposure: false,
        weicTags: ["C", "I"],
      },
      {
        lessonId: "writing-short-retells",
        title: "Writing a Short Retell",
        objective: "Write a short retell that keeps the main events in order.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["written retelling", "main events", "sequence"],
        skillTags: ["writing sentences", "organizing ideas"],
        prerequisites: ["oral retelling", "sequence words"],
        unlocks: ["summary writing", "main idea"],
        lessonOpeningRoutine: "Read a short retell and ask how the writer kept the order clear.",
        classroomActivities: [
          "Plan a retell using a beginning-middle-end frame.",
          "Draft and reread a short retell with a partner.",
        ],
        groupWorkTask: "Pairs check whether each written retell keeps the right order and enough detail.",
        projectTask: "Turn the retell into a mini class booklet with one picture for each part.",
        pacingGuidance: "Keep the writing short enough to protect revision time.",
        materialsNeeded: ["story frame", "exercise books", "pencils"],
        differentiationNotes: ["Allow sentence frames for writers who need support.", "Ask stronger learners to include one key detail in each part."],
        commonMisconceptions: ["Learners copy too many details and lose the order.", "Learners omit the ending."],
        explanation: "A short retell includes the important events in the correct order without retelling every small detail.",
        workedExamples: ["Model a three-sentence retell that keeps only the key events."],
        guidedPractice: ["Complete a retell frame together.", "Choose the event that should not be included."],
        independentPractice: ["Write a short retell from the class story.", "Underline the sequence words used."],
        quickChecks: ["Did your retell include the ending?"],
        practiceQuestions: ["Which event is most important to keep?", "Where should the retell begin?"],
        remediationTasks: ["Return to an oral retell first, then copy the three-part frame."],
        challengeTasks: ["Write a cleaner retell with fewer words but the same meaning."],
        guardianSupportNote: "Ask your child to read or say the short retell aloud and check whether the events stay in order.",
        homePracticeSuggestion: "Have your child retell a simple family event in three short steps.",
        whatToLookFor: "Students should keep only the main events and maintain order.",
        simplifiedInstructions: "Ask, 'Did you start at the beginning and end at the ending?'",
        noMaterialVariant: "Retell orally if writing tools are unavailable.",
        voiceFriendlyScript: "Read your short retell to me and show how the events stay in order.",
        guardianLoadLevel: "low",
        realWorldApplication: "Retelling helps learners explain instructions, routines, and stories clearly.",
        careerConnection: "Clear written sequence supports communication in many future roles.",
        digitalConnection: "A slide outline can help learners organize the beginning, middle, and end visually.",
        discussionPrompt: "How do we decide which details to keep in a short retell?",
        teacherNotes: "Keep literacy support lightweight and do not overburden families.",
        lessonType: "practice",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["C", "I"],
      },
      createStructuredLessonSeed({
        lessonId: "grade3-comprehension-key-details",
        title: "Understanding Key Details in a Short Text",
        objective: "Identify key details in a short Grade 3 text and explain how they help understanding.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["key details", "comprehension", "short texts"],
        skillTags: ["finding details", "explaining understanding"],
        prerequisites: ["story order", "sequence words"],
        unlocks: ["comprehension questions", "main message"],
        lessonType: "core",
        unitTitle: "Sequencing and Retelling",
        subjectLabel: "Literacy",
        guardianLoadLevel: "low",
        labExposure: "supporting",
        simulationExposure: false,
        realWorldApplication: "children use key details to follow instructions and understand short messages",
        careerConnection: "clear reading supports all later study and work habits",
        digitalConnection: "a simple picture-plus-text slide can help children connect details to meaning",
        weicTags: ["C", "I"],
      }),
      createStructuredLessonSeed({
        lessonId: "grade3-answering-comprehension-questions",
        title: "Answering Simple Comprehension Questions",
        objective: "Answer simple comprehension questions using evidence from a short text.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["comprehension questions", "text evidence", "short answers"],
        skillTags: ["answering questions", "using text evidence"],
        prerequisites: ["key details", "comprehension"],
        unlocks: ["oral explanation", "main message"],
        lessonType: "practice",
        unitTitle: "Sequencing and Retelling",
        subjectLabel: "Literacy",
        guardianLoadLevel: "low",
        labExposure: "none",
        simulationExposure: false,
        realWorldApplication: "children answer questions about notices, stories, and simple instructions every day",
        careerConnection: "evidence-based answers support strong communication later in school and work",
        digitalConnection: "audio or slide prompts can reinforce question-and-answer routines",
        weicTags: ["C", "I"],
      }),
    ],
  },
  {
    unitId: "literacy-g6-main-idea-summary",
    subject: "LITERACY",
    gradeLevel: 6,
    coverage: "partial",
    unitTitle: "Main Idea and Summary",
    unitObjectives: [
      "Identify the main idea of a short text and connect supporting details to it.",
      "Write or say a concise summary without copying every detail.",
    ],
    unitPrerequisites: [
      "Read short passages with teacher guidance.",
      "Identify key details from a paragraph.",
    ],
    assessmentPlan: {
      quickChecks: ["State the main idea of a short paragraph."],
      practiceQuestions: ["Which detail best supports the main idea?", "Which sentence is too minor to keep in a summary?"],
      remediationTasks: ["Use a topic-detail-main-idea organizer before summarizing."],
      challengeTasks: ["Summarize two connected paragraphs in one short statement."],
      unitTestFocus: ["main idea identification", "concise summary writing"],
    },
    lessons: [
      {
        lessonId: "finding-main-idea",
        title: "Finding the Main Idea",
        objective: "Identify the main idea of a paragraph using topic and supporting details.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["main idea", "supporting details", "paragraph meaning"],
        skillTags: ["identifying main idea", "evidence selection"],
        prerequisites: ["reading short passages", "finding key details"],
        unlocks: ["summarizing", "note-making"],
        lessonOpeningRoutine: "Read a short paragraph and ask what it is mostly about.",
        classroomActivities: [
          "Highlight key details and decide which one sentence captures the main idea.",
          "Sort possible main-idea statements into strong and weak choices.",
        ],
        groupWorkTask: "Groups justify why one candidate sentence fits the paragraph better than the others.",
        projectTask: "Create a main-idea anchor chart with one paragraph and one justified answer.",
        pacingGuidance: "Balance reading with evidence-based explanation; avoid too many passages at once.",
        materialsNeeded: ["short paragraphs", "highlighters or pencils", "exercise books"],
        differentiationNotes: ["Use shorter paragraphs for support.", "Ask stronger learners to explain why distractor statements fail."],
        commonMisconceptions: ["Learners choose a small detail as the main idea.", "Learners copy the first sentence without checking meaning."],
        explanation: "The main idea tells what the whole paragraph is mostly about. Supporting details help explain or prove that main idea.",
        workedExamples: ["Model how to reject a detail that is true but too narrow to be the main idea."],
        guidedPractice: ["Choose the best main-idea statement from three options.", "Underline one supporting detail."],
        independentPractice: ["Read a short paragraph and write the main idea.", "Circle the detail that best supports it."],
        quickChecks: ["What is this paragraph mostly about?"],
        practiceQuestions: ["Which detail supports the main idea best?", "Why is one sentence only a detail and not the main idea?"],
        remediationTasks: ["Use a three-box organizer: topic, details, main idea."],
        challengeTasks: ["Write your own main-idea statement for a paragraph without answer choices."],
        guardianSupportNote: "Ask your child what a short paragraph is mostly about and which detail helped them decide.",
        homePracticeSuggestion: "Read one short paragraph together and ask for the main idea in one sentence.",
        whatToLookFor: "Students should choose an idea broad enough to cover the whole paragraph.",
        simplifiedInstructions: "Ask, 'What is the paragraph mostly about?'",
        noMaterialVariant: "Use one spoken paragraph and ask for the main idea orally.",
        voiceFriendlyScript: "Tell me the big idea of the paragraph and one detail that proves it.",
        guardianLoadLevel: "low",
        realWorldApplication: "Finding the main idea helps learners study and communicate clearly.",
        careerConnection: "Strong readers identify key messages quickly in many professions.",
        digitalConnection: "A simple highlight-and-select task can reinforce main-idea practice.",
        discussionPrompt: "Why is a true detail not always the main idea?",
        teacherNotes: "Keep the passage short enough for discussion and evidence talk.",
        lessonType: "core",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["C", "I"],
      },
      {
        lessonId: "supporting-details-and-relevance",
        title: "Supporting Details and Relevance",
        objective: "Identify which details support the main idea and which details are less important.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["supporting details", "relevance", "main idea support"],
        skillTags: ["selecting evidence", "evaluating relevance"],
        prerequisites: ["main idea", "paragraph reading"],
        unlocks: ["summary writing", "note-making"],
        lessonOpeningRoutine: "Display three details and ask which one least supports the main idea.",
        classroomActivities: [
          "Match supporting details to one main idea sentence.",
          "Remove an unimportant detail and explain why it can be left out.",
        ],
        groupWorkTask: "Groups sort details into strong support and weak support.",
        projectTask: "Build a relevance chart for one short text.",
        pacingGuidance: "Keep the sort activity brisk and use talk moves to justify choices.",
        materialsNeeded: ["detail cards", "short text", "exercise books"],
        differentiationNotes: ["Use color coding for support.", "Ask stronger learners to revise a weak detail into a better one."],
        commonMisconceptions: ["Learners keep interesting but irrelevant details.", "Learners remove a key detail by mistake."],
        explanation: "Supporting details help prove the main idea. Less important details may be interesting, but they do not carry the main message of the paragraph.",
        workedExamples: ["Show one strong supporting detail and one detail that is true but less relevant."],
        guidedPractice: ["Choose the detail that best supports the main idea.", "Cross out one less important detail."],
        independentPractice: ["List two supporting details from a short text.", "Explain why one detail is less important."],
        quickChecks: ["Which detail best supports the main idea?"],
        practiceQuestions: ["Which detail can be removed from the summary?", "Why is one detail more relevant than another?"],
        remediationTasks: ["Use a sorting frame with labels 'keep' and 'leave out'."],
        challengeTasks: ["Revise a poor summary by replacing one weak detail with a stronger one."],
        guardianSupportNote: "Ask your child which detail matters most in a short paragraph and why.",
        homePracticeSuggestion: "Use a short article or passage and ask which detail should be kept in a summary.",
        whatToLookFor: "Students should keep details that prove the main idea best.",
        simplifiedInstructions: "Ask, 'Which detail helps the big idea the most?'",
        noMaterialVariant: "Use one spoken paragraph and choose details orally.",
        voiceFriendlyScript: "Tell me which detail matters most and why it helps the big idea.",
        guardianLoadLevel: "low",
        realWorldApplication: "Choosing relevant information helps learners study efficiently.",
        careerConnection: "People in many jobs must identify the most important information quickly.",
        digitalConnection: "A highlight-and-sort activity can support relevance decisions.",
        discussionPrompt: "How do we know when a detail is interesting but not necessary?",
        teacherNotes: "Use this lesson to prepare learners for short written summaries.",
        lessonType: "practice",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["C", "I"],
      },
      {
        lessonId: "writing-short-summaries",
        title: "Writing a Short Summary",
        objective: "Write a short summary that states the main idea and includes only key details.",
        targetDifficulty: "advanced",
        masteryLevel: "advanced",
        conceptTags: ["summary writing", "main idea", "key details"],
        skillTags: ["concise writing", "synthesizing information"],
        prerequisites: ["supporting details", "paragraph meaning"],
        unlocks: ["multi-paragraph summary", "note-making"],
        lessonOpeningRoutine: "Compare a strong short summary with an overly detailed retelling.",
        classroomActivities: [
          "Reduce a paragraph to one main idea and two key details.",
          "Revise a summary that includes too many minor details.",
        ],
        groupWorkTask: "Pairs review one another's summary for clarity, accuracy, and brevity.",
        projectTask: "Produce a one-paragraph class summary from a short informational text.",
        pacingGuidance: "Protect revision time so learners can remove extra detail.",
        materialsNeeded: ["short text", "summary frame", "exercise books"],
        differentiationNotes: ["Provide a summary frame for support.", "Ask advanced learners to summarize without the frame."],
        commonMisconceptions: ["Learners copy whole sentences from the text.", "Learners include every detail and lose concision."],
        explanation: "A summary tells the main idea and only the most important supporting details. It should be shorter than the original text and should not repeat every example.",
        workedExamples: ["Model how to shorten a paragraph into one clear summary sentence and two supporting points."],
        guidedPractice: ["Underline the main idea, then choose two details to keep.", "Rewrite a long retelling as a concise summary."],
        independentPractice: ["Write a short summary of a short text.", "Check whether any sentence can be removed without losing meaning."],
        quickChecks: ["Does your summary say the main idea clearly?"],
        practiceQuestions: ["Which detail should be removed from the summary?", "How can this summary be made shorter?"],
        remediationTasks: ["Use a summary frame: main idea plus two key details."],
        challengeTasks: ["Summarize two connected paragraphs in one concise statement."],
        guardianSupportNote: "Ask your child to say the big idea of a short text and only the two most important details.",
        homePracticeSuggestion: "Read a short passage and ask for a quick summary in one or two sentences.",
        whatToLookFor: "Students should be concise and accurate, not overly detailed.",
        simplifiedInstructions: "Ask, 'What is the big idea, and which two details matter most?'",
        noMaterialVariant: "Use a spoken paragraph and summarize it aloud.",
        voiceFriendlyScript: "Tell me the big idea and the two details that matter most, but keep it short.",
        guardianLoadLevel: "medium",
        realWorldApplication: "Summary writing helps learners study, report information, and communicate clearly.",
        careerConnection: "Summaries are used in administration, journalism, teaching, and business.",
        digitalConnection: "Slides or notes tools can help learners organize main idea and key details.",
        discussionPrompt: "Why is a shorter accurate summary stronger than a long retelling?",
        teacherNotes: "Treat this as the partial-unit capstone and align the assessment to concise writing.",
        lessonType: "assessment",
        labExposure: "none",
        simulationExposure: false,
        weicTags: ["C", "I"],
      },
      createStructuredLessonSeed({
        lessonId: "grade6-making-inferences",
        title: "Making Inferences from Text",
        objective: "Make simple inferences from a passage using clues and prior understanding.",
        targetDifficulty: "standard",
        masteryLevel: "secure",
        conceptTags: ["inference", "text clues", "reader thinking"],
        skillTags: ["making inferences", "using clues"],
        prerequisites: ["main idea", "supporting details"],
        unlocks: ["evidence-based interpretation", "author meaning"],
        lessonType: "core",
        unitTitle: "Main Idea and Summary",
        subjectLabel: "Literacy",
        guardianLoadLevel: "low",
        labExposure: "none",
        simulationExposure: false,
        realWorldApplication: "readers infer meaning in messages, news, and instructions when everything is not stated directly",
        careerConnection: "inference supports decision-making, reading accuracy, and strong communication",
        digitalConnection: "highlight-and-clue tasks can support inference practice",
        weicTags: ["C", "I"],
      }),
      createStructuredLessonSeed({
        lessonId: "grade6-inference-with-evidence",
        title: "Supporting Inferences with Evidence",
        objective: "Support an inference with clear evidence from the text.",
        targetDifficulty: "advanced",
        masteryLevel: "advanced",
        conceptTags: ["inference evidence", "text support", "justified interpretation"],
        skillTags: ["supporting claims", "citing evidence"],
        prerequisites: ["inference", "supporting details"],
        unlocks: ["summary with evidence", "deeper comprehension"],
        lessonType: "assessment",
        unitTitle: "Main Idea and Summary",
        subjectLabel: "Literacy",
        guardianLoadLevel: "medium",
        labExposure: "none",
        simulationExposure: false,
        realWorldApplication: "strong readers explain not just what they think, but what evidence supports it",
        careerConnection: "evidence-based reasoning is central to law, journalism, teaching, and management",
        digitalConnection: "annotation tools can help connect claims to evidence",
        weicTags: ["C", "I"],
      }),
    ],
  },
  ...createGrade10MathUnitSeeds(),
];

const UNIT_SEEDS: UnitSeed[] = [
  ...CURATED_UNIT_SEEDS,
  ...createPhaseOneGeneratedUnitSeeds(CURATED_UNIT_SEEDS),
];

function buildUnit(seed: UnitSeed): GeneratedCurriculumUnit {
  const lessons = seed.lessons.map((lesson, index) => buildLesson(seed, lesson, index + 1));
  const distributedLabs = lessons
    .filter((lesson) => lesson.pseudoLabs.length > 0)
    .map((lesson) => ({
      lessonId: lesson.lessonId,
      title: lesson.title,
      priority: lesson.pseudoLabs[0]?.priority ?? "supporting",
      difficulty: lesson.pseudoLabs[0]?.difficulty ?? lesson.targetDifficulty,
      simulationAttached: lesson.simulationDefinitions.length > 0,
    }));

  const majorLab = distributedLabs.find((lab) => lab.priority === "core") ?? distributedLabs[0];
  const miniLabs = distributedLabs.filter((lab) => lab.lessonId !== majorLab?.lessonId);

  return {
    unitId: seed.unitId,
    gradeLevel: seed.gradeLevel,
    subject: seed.subject,
    coverage: seed.coverage,
    unitTitle: seed.unitTitle,
    unitObjectives: seed.unitObjectives,
    unitPrerequisites: seed.unitPrerequisites,
    lessonSequence: lessons.map((lesson, index) => ({
      lessonId: lesson.lessonId,
      title: lesson.title,
      order: index + 1,
    })),
    assessmentPlan: seed.assessmentPlan,
    unitLabPlan: {
      majorLabLessonId: majorLab?.lessonId ?? lessons[0].lessonId,
      majorLabPriority: "core",
      miniLabLessonIds: miniLabs.length > 0 ? miniLabs.map((lab) => lab.lessonId) : [lessons[0].lessonId],
      distributedLabs: distributedLabs.length > 0
        ? distributedLabs
        : [
            {
              lessonId: lessons[0].lessonId,
              title: lessons[0].title,
              priority: "optional",
              difficulty: lessons[0].targetDifficulty,
              simulationAttached: false,
            },
          ],
    },
    lessons,
  };
}

export function buildCurriculumExpansionBatch(): CurriculumExpansionBatch {
  const batch = CurriculumExpansionBatchSchema.parse({
    curriculumVersion: CURRICULUM_VERSION,
    generationBatchId: GENERATION_BATCH_ID,
    units: UNIT_SEEDS.map(buildUnit),
  });

  const validation = validateCurriculumExpansionBatch(batch);
  if (!validation.valid) {
    throw new Error(`Curriculum expansion concept graph invalid: ${validation.errors.join(", ")}`);
  }

  return batch;
}

export function buildCurriculumExpansionRecords(): CurriculumExpansionRecord[] {
  const batch = buildCurriculumExpansionBatch();

  return batch.units.flatMap((unit) =>
    unit.lessons.map((lesson, index) => {
      const payload = buildPayload(
        UNIT_SEEDS.find((seed) => seed.unitId === unit.unitId)!,
        lesson,
        index + 1
      );

      return {
        contentId: buildContentId(unit.subject, unit.gradeLevel, lesson.lessonId),
        grade: unit.gradeLevel,
        subject: unit.subject,
        contentType: "lesson" as const,
        version: CURRICULUM_VERSION,
        unitId: unit.unitId,
        orderInUnit: index + 1,
        lessonType: UNIT_SEEDS.find((seed) => seed.unitId === unit.unitId)!.lessons[index].lessonType,
        curriculumVersion: CURRICULUM_VERSION,
        generationBatchId: GENERATION_BATCH_ID,
        hash: hashPayload(payload),
        payload,
      };
    })
  );
}

export function summarizeCurriculumExpansion() {
  const batch = buildCurriculumExpansionBatch();
  const records = buildCurriculumExpansionRecords();

  const chunkReadyLessons = records.filter((record) => {
    const payload = record.payload as Record<string, unknown>;
    return Boolean(payload.objective) && Array.isArray(payload.workedExamples) && Array.isArray(payload.guidedPractice);
  }).length;

  return {
    curriculumVersion: CURRICULUM_VERSION,
    generationBatchId: GENERATION_BATCH_ID,
    units: batch.units.length,
    lessons: records.length,
    fullCoverageUnits: batch.units.filter((unit) => unit.coverage === "full").length,
    partialCoverageUnits: batch.units.filter((unit) => unit.coverage === "partial").length,
    pseudoLabs: batch.units.reduce((sum, unit) => sum + unit.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.pseudoLabs.length, 0), 0),
    simulations: batch.units.reduce((sum, unit) => sum + unit.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.simulationDefinitions.length, 0), 0),
    chunkReadyLessons,
  };
}

export { CURRICULUM_VERSION, GENERATION_BATCH_ID };
