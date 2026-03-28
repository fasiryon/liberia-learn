import {
  type AudioScriptSpec,
  type LabDefinitionSpec,
  type SlideDeckSpec,
  type VideoStoryboardSpec,
  type VisualAssetSpec,
} from "@/lib/schemas/curriculumFramework";
import type {
  PseudoLab,
  SimulationDefinition,
  ThreeDLabDefinition,
} from "@/lib/schemas/labSimulation";
import { generateLessonLabSimulationBundleBestEffort } from "@/lib/curriculum/labSimulation";

export type MediaGenerationInput = {
  sourceLessonId: string;
  subject: string;
  grade: number;
  unitTitle: string;
  lessonTitle: string;
  objective: string;
  teacherExplanation: string;
  workedExamples: string[];
  guidedPractice: string[];
  groupWorkTask: string;
  guardianSupportNote: string;
  homePracticeSuggestion: string;
  realWorldApplication: string;
  digitalConnection: string;
  materialsNeeded: string[];
};

export type MediaGenerationBundle = {
  visualAssetSpecs: VisualAssetSpec[];
  audioScriptSpecs: AudioScriptSpec[];
  slideDeckSpecs: SlideDeckSpec[];
  videoStoryboardSpecs: VideoStoryboardSpec[];
  labDefinitionSpecs: LabDefinitionSpec[];
  pseudoLabs: PseudoLab[];
  simulationDefinitions: SimulationDefinition[];
  threeDLabDefinitions: ThreeDLabDefinition[];
  mediaGenerationStatus: "ready" | "deferred";
  mediaGenerationErrors: string[];
};

function buildBase(input: MediaGenerationInput, format: string) {
  return {
    format,
    version: "1.0",
    sourceLessonId: input.sourceLessonId,
    generationProfile: `curriculum-framework-g${input.grade}-${input.subject.toLowerCase()}`,
    approved: false,
    renderStatus: "ready" as const,
    fallbackAvailable: true,
  };
}

export function generateMediaArtifacts(input: MediaGenerationInput): MediaGenerationBundle {
  const visualAssetSpecs: VisualAssetSpec[] = [
    {
      ...buildBase(input, "visual_spec_json"),
      title: `${input.lessonTitle} Core Visual`,
      objective: input.objective,
      visualType: "concept_visual",
      prompt: `Create a grade-appropriate concept visual for ${input.lessonTitle} in ${input.subject}, grounded in ${input.realWorldApplication}.`,
      ageAppropriate: `Grade ${input.grade} learners with teacher-led explanation.`,
      culturalContext: "Liberia-relevant examples where useful, otherwise culturally neutral classroom imagery.",
      conceptAccuracyNotes: `Keep the explanation consistent with: ${input.teacherExplanation.slice(0, 180)}`,
      fallbackStaticText: `Teacher fallback: explain ${input.objective} using board sketches and the first worked example.`,
    },
  ];

  const audioScriptSpecs: AudioScriptSpec[] = [
    {
      ...buildBase(input, "audio_script_json"),
      mode: "teacher_narration",
      script: `Today we learn ${input.objective}. Start with this idea: ${input.teacherExplanation.slice(0, 220)}`,
      pronunciationFocus: [input.subject, ...input.lessonTitle.split(" ").slice(0, 2)],
      readingLevel: `Grade ${input.grade}`,
      durationTargetSeconds: 75,
      narrationStyle: "clear, calm, teacher-led",
      fallbackText: `Read the lesson objective and first worked example aloud, then pause for student explanation.`,
    },
    {
      ...buildBase(input, "audio_script_json"),
      mode: "student_support",
      script: `Remember the key idea: ${input.objective}. Try this first step: ${input.guidedPractice[0] ?? input.workedExamples[0] ?? input.teacherExplanation}`,
      pronunciationFocus: [input.subject],
      readingLevel: `Grade ${input.grade}`,
      durationTargetSeconds: 45,
      narrationStyle: "short, supportive, learner-friendly",
      fallbackText: `Use the teacher explanation and one guided-practice item as a short oral recap.`,
    },
  ];

  const slideDeckSpecs: SlideDeckSpec[] = [
    {
      ...buildBase(input, "slide_deck_json"),
      deckTitle: `${input.lessonTitle} Teacher Deck`,
      slideCountLimit: 7,
      slides: [
        { slideNumber: 1, slideType: "title", title: input.lessonTitle, bullets: [`Subject: ${input.subject}`, `Grade ${input.grade}`], teacherNote: "Set context and welcome students." },
        { slideNumber: 2, slideType: "objective", title: "Objective", bullets: [input.objective], teacherNote: "State success criteria clearly." },
        { slideNumber: 3, slideType: "explanation", title: "Explain", bullets: [input.teacherExplanation], teacherNote: "Use board modeling and questioning." },
        { slideNumber: 4, slideType: "worked_example", title: "Worked Example", bullets: input.workedExamples.slice(0, 2), teacherNote: "Model the method step by step." },
        { slideNumber: 5, slideType: "guided_practice", title: "Guided Practice", bullets: input.guidedPractice.slice(0, 3), teacherNote: "Prompt partner talk before answers." },
        { slideNumber: 6, slideType: "group_task", title: "Group Task", bullets: [input.groupWorkTask], teacherNote: "Assign roles and keep time visible." },
        { slideNumber: 7, slideType: "assessment_exit_ticket", title: "Exit Ticket", bullets: [`Apply the lesson objective independently.`, input.homePracticeSuggestion], teacherNote: "Collect one clear evidence point before dismissal." },
      ],
      teacherPacingNotes: [
        "Keep the explanation short enough to protect practice time.",
        "Use the worked example slide before students start partner work.",
      ],
      exportIntent: "pptx_compatible",
    },
  ];

  const videoStoryboardSpecs: VideoStoryboardSpec[] = [
    {
      ...buildBase(input, "video_storyboard_json"),
      title: `${input.lessonTitle} Micro-Lesson`,
      durationTargetSeconds: 120,
      narrationStyle: "instructional and concise",
      sceneCountLimit: 4,
      scenes: [
        { sceneNumber: 1, sceneObjective: "State the lesson goal", narration: input.objective, visualDirection: "Show title and one Liberia-relevant context image or sketch." },
        { sceneNumber: 2, sceneObjective: "Explain the key concept", narration: input.teacherExplanation.slice(0, 180), visualDirection: "Use one clean concept visual with labeled parts." },
        { sceneNumber: 3, sceneObjective: "Model one example", narration: input.workedExamples[0] ?? input.guidedPractice[0] ?? input.teacherExplanation, visualDirection: "Animate the steps or reveal them one by one." },
        { sceneNumber: 4, sceneObjective: "Prompt independent thinking", narration: input.guidedPractice[0] ?? input.objective, visualDirection: "Close with one prompt and one practical takeaway." },
      ],
      keyVisualMoments: [
        "Objective reveal",
        "Concept visual with labels",
        "Worked example solution path",
      ],
      fallbackSummary: `If video production is deferred, use the slide deck and teacher narration script to cover the same sequence.`,
    },
  ];

  const labDefinitionSpecs: LabDefinitionSpec[] = [
    {
      ...buildBase(input, "lab_definition_json"),
      labType: "classroom",
      title: `${input.lessonTitle} Applied Lab`,
      objective: input.objective,
      riskLevel: "low",
      requiredMaterials: input.materialsNeeded.length > 0 ? input.materialsNeeded.slice(0, 4) : ["paper", "exercise books"],
      optionalMaterials: ["markers", "local manipulatives"],
      setupTimeMinutes: 5,
      executionTimeMinutes: 20,
      cleanupNotes: "Return shared materials, collect student artifacts, and reset board space.",
      safetyNotes: "Use only low-risk classroom materials and maintain supervised movement.",
      procedureSteps: [
        "Introduce the task and connect it to the lesson objective.",
        "Model the first step with one worked example.",
        "Students complete the task in pairs or groups using available materials.",
        "Debrief observations and connect them back to the main concept.",
      ],
      expectedObservation: `Students should show evidence that they can apply ${input.objective.toLowerCase()}.`,
      explanation: input.realWorldApplication,
      reflectionQuestions: [
        "What helped you understand the concept more clearly?",
        "Where might this skill matter outside school?",
      ],
      fallbackIfNoMaterials: `Use board modeling and oral reasoning with ${input.guidedPractice[0] ?? input.teacherExplanation}.`,
      simulationFallback: `If devices exist, convert the task into a simple teacher-led simulation using ${input.digitalConnection}.`,
      threeDReady: true,
    },
  ];
  const labSimulationBundle = generateLessonLabSimulationBundleBestEffort({
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.grade,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.objective,
  });

  return {
    visualAssetSpecs,
    audioScriptSpecs,
    slideDeckSpecs,
    videoStoryboardSpecs,
    labDefinitionSpecs,
    pseudoLabs: labSimulationBundle.pseudoLabs,
    simulationDefinitions: labSimulationBundle.simulationDefinitions,
    threeDLabDefinitions: labSimulationBundle.threeDLabDefinitions,
    mediaGenerationStatus:
      labSimulationBundle.generationStatus === "deferred" ? "deferred" : "ready",
    mediaGenerationErrors: labSimulationBundle.generationErrors,
  };
}

export function generateMediaArtifactsBestEffort(
  input: MediaGenerationInput
): MediaGenerationBundle {
  try {
    return generateMediaArtifacts(input);
  } catch (error: any) {
    return {
      visualAssetSpecs: [],
      audioScriptSpecs: [],
      slideDeckSpecs: [],
      videoStoryboardSpecs: [],
      labDefinitionSpecs: [],
      pseudoLabs: [],
      simulationDefinitions: [],
      threeDLabDefinitions: [],
      mediaGenerationStatus: "deferred",
      mediaGenerationErrors: [error?.message ?? "media_generation_failed"],
    };
  }
}
