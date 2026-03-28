import {
  PseudoLabSchema,
  SimulationDefinitionSchema,
  ThreeDLabDefinitionSchema,
  type PseudoLab,
  type SimulationDefinition,
  type ThreeDLabDefinition,
} from "@/lib/schemas/labSimulation";

export type LessonLabSimulationInput = {
  sourceLessonId: string;
  subject: string;
  gradeLevel: number;
  unitTitle: string;
  lessonTitle: string;
  lessonObjective: string;
};

export type LessonLabSimulationBundle = {
  pseudoLabs: PseudoLab[];
  simulationDefinitions: SimulationDefinition[];
  threeDLabDefinitions: ThreeDLabDefinition[];
  generationStatus: "ready" | "deferred";
  generationErrors: string[];
};

type DraftBundle = {
  pseudoLabs: PseudoLab[];
  simulationDefinitions: SimulationDefinition[];
  threeDLabDefinitions: ThreeDLabDefinition[];
};

type ValidationResult<T> = {
  valid: T[];
  errors: string[];
};

function normalizeSubject(subject: string): string {
  return subject.trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchesAny(text: string, terms: string[]): boolean {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function buildFractionBundle(input: LessonLabSimulationInput): DraftBundle {
  const baseId = `${input.sourceLessonId}-fraction`;
  const pseudoLab = PseudoLabSchema.parse({
    id: `${baseId}-pseudo`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Fraction Strip Comparison Lab",
    objective: input.lessonObjective,
    labType: "classroom",
    difficulty: "standard",
    priority: "core",
    resourceLevel: "low",
    offlineCapable: true,
    deviceRequired: "none",
    electricityRequired: false,
    riskLevel: "low",
    requiredMaterials: ["paper strips", "markers", "exercise books"],
    optionalMaterials: ["string number line", "bottle caps"],
    setupTimeMinutes: 5,
    runTimeMinutes: 18,
    cleanupTimeMinutes: 4,
    prepComplexity: "low",
    safetyNotes: "Use only paper and classroom manipulatives. Keep the floor clear during group movement.",
    setupInstructions: [
      "Prepare paper strips of equal length and label each group set before class begins.",
      "Write the lesson objective and one benchmark fraction on the board.",
    ],
    procedureSteps: [
      "Students fold paper strips into halves, thirds, fourths, and eighths to build comparison models.",
      "Pairs place the strips side by side and decide which fraction is greater using the physical models first.",
      "Groups record one comparison solved with strips and one solved using common denominators.",
    ],
    expectedObservation: "Students notice that equal whole sizes matter and that benchmark fractions make some comparisons faster.",
    explanation: "The lab makes fraction size visible so learners can connect concrete models to symbolic comparison strategies.",
    reflectionQuestions: [
      "When did the paper strips help more than calculation alone?",
      "How do benchmark fractions help you explain which fraction is larger?",
    ],
    extensionIdea: "Ask stronger learners to compare two fractions mentally before checking with the paper model.",
    guardianHomeVariant: "Use cups, bread pieces, or bottle-cap groups at home to compare two fractions and ask the child to explain the method aloud.",
    fallbackMode: "teacher_demonstration",
    fallbackIfNoMaterials: "Draw equal bars on the board and have students shade them instead of using paper strips.",
    expectedCompletionTimeMinutes: 18,
    expectedSuccessRate: 0.72,
    commonConfusionSignals: ["Learner compares denominators only", "Learner forgets equal whole sizes"],
    conceptTags: ["fraction comparison", "benchmarks", "equivalent fractions"],
    simulationType: "slider",
    threeDLabReady: true,
    renderStatus: "ready",
    approved: true,
  });

  const simulation = SimulationDefinitionSchema.parse({
    id: `${baseId}-sim`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Fraction Bar Visualizer",
    simulationType: "slider",
    rendererKey: "fraction_bar_visualizer",
    fallbackRendererKey: "static_fraction_bar",
    inputs: [
      { key: "numeratorA", label: "Fraction A numerator", type: "range", min: 1, max: 8, step: 1, defaultValue: 3 },
      { key: "denominatorA", label: "Fraction A denominator", type: "range", min: 2, max: 8, step: 1, defaultValue: 4 },
      { key: "numeratorB", label: "Fraction B numerator", type: "range", min: 1, max: 8, step: 1, defaultValue: 5 },
      { key: "denominatorB", label: "Fraction B denominator", type: "range", min: 2, max: 8, step: 1, defaultValue: 8 },
    ],
    outputs: [
      { key: "comparison", label: "Comparison", description: "Shows which fraction is greater or whether they are equal." },
      { key: "benchmark", label: "Benchmark check", description: "Explains how each fraction compares to one-half." },
    ],
    interactionModel: "Students move sliders to build two fractions, then compare the bar sizes and benchmark notes.",
    uiConfig: {
      compact: false,
      showTeacherNotes: true,
      showGuardianMode: true,
      accentColor: "emerald",
    },
    objective: input.lessonObjective,
    explanation: "The simulation gives a low-friction visual check that matches the same reasoning used in the paper-strip lab.",
    teacherGuide: "Use after the hands-on task to confirm reasoning. Ask students to predict the result before moving the sliders.",
    guardianGuide: "If using a shared phone, keep the focus on one comparison and ask the learner to explain why the bars look different.",
    fallbackStaticVisual: "If no device is available, draw two bars with equal wholes and label the numerator and denominator under each.",
    attemptTrackingEnabled: true,
    supportsStateSave: false,
    stateSchema: { numeratorA: "number", denominatorA: "number", numeratorB: "number", denominatorB: "number" },
    progressTrackingEnabled: true,
    renderStatus: "ready",
    approved: true,
  });

  const threeD = ThreeDLabDefinitionSchema.parse({
    id: `${baseId}-3d`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    title: "Fraction Marketplace 3D Planning Stub",
    objective: input.lessonObjective,
    sceneType: "market_stall_measurement",
    requiredObjects: ["fraction trays", "shared goods", "benchmark markers"],
    interactions: [
      "Compare quantities by placing portions on equivalent trays.",
      "Swap between benchmark and common-denominator views.",
    ],
    learningChecks: [
      "Learner identifies the larger fraction correctly.",
      "Learner explains the chosen comparison strategy.",
    ],
    teacherGuide: "Use only as a planning reference for future immersive builds. The current lesson should rely on the pseudo lab and 2D simulation.",
    fallbackMode: "Use the paper-strip pseudo lab and the fraction bar visualizer instead of a 3D scene.",
    status: "simulation_ready",
  });

  return {
    pseudoLabs: [pseudoLab],
    simulationDefinitions: [simulation],
    threeDLabDefinitions: [threeD],
  };
}

function buildPhotosynthesisBundle(input: LessonLabSimulationInput): DraftBundle {
  const baseId = `${input.sourceLessonId}-photosynthesis`;
  const pseudoLab = PseudoLabSchema.parse({
    id: `${baseId}-pseudo`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Leaf Light and Water Observation Lab",
    objective: input.lessonObjective,
    labType: "classroom",
    difficulty: "standard",
    priority: "core",
    resourceLevel: "low",
    offlineCapable: true,
    deviceRequired: "none",
    electricityRequired: false,
    riskLevel: "low",
    requiredMaterials: ["two leaves or plant samples", "water", "exercise books"],
    optionalMaterials: ["transparent cup", "sunlit window", "hand lens"],
    setupTimeMinutes: 6,
    runTimeMinutes: 20,
    cleanupTimeMinutes: 4,
    prepComplexity: "low",
    safetyNotes: "Use safe household plant materials only. Wash hands after handling leaves or soil.",
    setupInstructions: [
      "Prepare one plant sample with light access and one sample kept in shade if possible.",
      "Explain that students are observing conditions that help plants make food.",
    ],
    procedureSteps: [
      "Students inspect the plant samples and list signs of healthy growth.",
      "Pairs predict what will happen if a plant lacks light or water over time.",
      "Groups connect their observations to the lesson explanation of photosynthesis.",
    ],
    expectedObservation: "Students recognize that light and water conditions affect plant health and growth.",
    explanation: "The pseudo lab supports the idea that plants need key conditions to make food and stay healthy.",
    reflectionQuestions: [
      "Why does a plant in shade often grow differently from one in light?",
      "What evidence from the samples supports your explanation?",
    ],
    extensionIdea: "Set a short home observation challenge where learners track one plant for three days.",
    guardianHomeVariant: "Use one small plant or leaf at home and ask the child to describe what helps the plant stay healthy using plain language.",
    fallbackMode: "observation_chart",
    fallbackIfNoMaterials: "Use a teacher-drawn plant comparison and ask learners to infer what happened in each condition.",
    expectedCompletionTimeMinutes: 20,
    expectedSuccessRate: 0.75,
    commonConfusionSignals: ["Learner treats water as the only condition", "Learner confuses plant food with soil"],
    conceptTags: ["photosynthesis", "plant needs", "observation"],
    simulationType: "slider",
    threeDLabReady: true,
    renderStatus: "ready",
    approved: true,
  });

  const simulation = SimulationDefinitionSchema.parse({
    id: `${baseId}-sim`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Plant Growth Variable Slider",
    simulationType: "slider",
    rendererKey: "plant_growth_slider",
    fallbackRendererKey: "static_plant_conditions",
    inputs: [
      { key: "light", label: "Light level", type: "range", min: 0, max: 10, step: 1, defaultValue: 8 },
      { key: "water", label: "Water level", type: "range", min: 0, max: 10, step: 1, defaultValue: 7 },
    ],
    outputs: [
      { key: "growth", label: "Growth outlook", description: "Shows whether growth conditions are weak, fair, or strong." },
      { key: "reasoning", label: "Reasoning", description: "Explains how light and water change the result." },
    ],
    interactionModel: "Students change light and water levels and observe how the growth indicator shifts.",
    uiConfig: {
      compact: false,
      showTeacherNotes: true,
      showGuardianMode: true,
      accentColor: "green",
    },
    objective: input.lessonObjective,
    explanation: "The simulation highlights that plant growth depends on more than one condition and supports cause-and-effect reasoning.",
    teacherGuide: "Use the sliders to test student predictions after the observation task. Keep the language focused on light, water, and plant food.",
    guardianGuide: "A guardian can ask, 'What changed when you reduced the light?' without needing science vocabulary.",
    fallbackStaticVisual: "If no device is available, draw three plant conditions on the board: strong light and water, low light, and low water.",
    attemptTrackingEnabled: true,
    supportsStateSave: false,
    stateSchema: { light: "number", water: "number" },
    progressTrackingEnabled: true,
    renderStatus: "ready",
    approved: true,
  });

  const threeD = ThreeDLabDefinitionSchema.parse({
    id: `${baseId}-3d`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    title: "Plant Cell Energy Flow 3D Planning Stub",
    objective: input.lessonObjective,
    sceneType: "plant_energy_flow",
    requiredObjects: ["leaf cross-section", "sunlight source", "water path", "gas exchange markers"],
    interactions: [
      "Trace sunlight, water, and air inputs through the plant scene.",
      "Reveal what changes when one needed condition is removed.",
    ],
    learningChecks: [
      "Learner identifies key conditions for photosynthesis.",
      "Learner explains one consequence of reduced light or water.",
    ],
    teacherGuide: "Future-ready only. Current classroom use should stay with the observation lab and slider simulation.",
    fallbackMode: "Replace the 3D scene with the board diagram and plant growth slider.",
    status: "simulation_ready",
  });

  return {
    pseudoLabs: [pseudoLab],
    simulationDefinitions: [simulation],
    threeDLabDefinitions: [threeD],
  };
}

function buildScienceInvestigationBundle(input: LessonLabSimulationInput): DraftBundle {
  const baseId = `${input.sourceLessonId}-water-cycle`;
  const pseudoLab = PseudoLabSchema.parse({
    id: `${baseId}-pseudo`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Evaporation and Condensation Cup Lab",
    objective: input.lessonObjective,
    labType: "classroom",
    difficulty: "intro",
    priority: "supporting",
    resourceLevel: "low",
    offlineCapable: true,
    deviceRequired: "none",
    electricityRequired: false,
    riskLevel: "low",
    requiredMaterials: ["cup or bottle", "water", "cover material"],
    optionalMaterials: ["ice", "marker", "sunlit space"],
    setupTimeMinutes: 5,
    runTimeMinutes: 20,
    cleanupTimeMinutes: 4,
    prepComplexity: "low",
    safetyNotes: "Use room-temperature water only for this classroom version. Avoid slippery spills.",
    setupInstructions: [
      "Fill a clear cup or bottle partway with water and place a simple cover on top.",
      "Mark the starting water level where students can see it.",
    ],
    procedureSteps: [
      "Students observe the container over time and note any droplets or level changes.",
      "Pairs explain where the droplets likely came from and what caused them.",
      "Groups compare their observations to the lesson explanation of evaporation and condensation.",
    ],
    expectedObservation: "Students notice water droplets forming and connect them to water changing state.",
    explanation: "The activity turns an abstract water-cycle idea into something students can observe safely in class.",
    reflectionQuestions: [
      "What evidence shows that water changed form during the activity?",
      "How is this similar to what happens in the wider water cycle?",
    ],
    extensionIdea: "Challenge learners to connect the cup model to rain formation in Liberia's wet season.",
    guardianHomeVariant: "At home, use a covered cup near a window and ask the child to explain what appears on the inside.",
    fallbackMode: "sequence_diagram",
    fallbackIfNoMaterials: "Use a sequence diagram on the board and ask students to narrate each stage of the process.",
    expectedCompletionTimeMinutes: 20,
    expectedSuccessRate: 0.78,
    commonConfusionSignals: ["Learner says droplets come from outside air only", "Learner mixes evaporation and condensation"],
    conceptTags: ["water cycle", "evaporation", "condensation"],
    simulationType: "step_based",
    threeDLabReady: true,
    renderStatus: "ready",
    approved: true,
  });

  const simulation = SimulationDefinitionSchema.parse({
    id: `${baseId}-sim`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Water Cycle Sequence Builder",
    simulationType: "step_based",
    rendererKey: "water_cycle_sequence",
    fallbackRendererKey: "static_water_cycle_sequence",
    inputs: [
      {
        key: "stages",
        label: "Order the stages",
        type: "order",
        options: ["evaporation", "condensation", "collection"],
        defaultValue: ["evaporation", "condensation", "collection"],
      },
    ],
    outputs: [
      { key: "sequenceCheck", label: "Sequence check", description: "Confirms whether the current order matches the lesson model." },
    ],
    interactionModel: "Students arrange the stages and receive a short explanation of the correct sequence.",
    uiConfig: {
      compact: true,
      showTeacherNotes: true,
      showGuardianMode: true,
      accentColor: "sky",
    },
    objective: input.lessonObjective,
    explanation: "The sequence task reinforces causal ordering without requiring devices for every student.",
    teacherGuide: "Use as a closing check after the cup lab or a fallback when materials are unavailable.",
    guardianGuide: "At home, ask the child to retell the sequence using rain, clouds, and puddles as examples.",
    fallbackStaticVisual: "Write the three stages on the board and have students point to the correct order with reasons.",
    attemptTrackingEnabled: true,
    supportsStateSave: false,
    stateSchema: { stages: "string[]" },
    progressTrackingEnabled: true,
    renderStatus: "ready",
    approved: true,
  });

  const threeD = ThreeDLabDefinitionSchema.parse({
    id: `${baseId}-3d`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    title: "Water Cycle Environment 3D Planning Stub",
    objective: input.lessonObjective,
    sceneType: "weather_landscape",
    requiredObjects: ["water body", "cloud layer", "sun icon", "terrain collection zones"],
    interactions: [
      "Turn sunlight on and off to change the system.",
      "Follow water particles through each stage.",
    ],
    learningChecks: [
      "Learner orders the water-cycle stages correctly.",
      "Learner explains one observed change in the system.",
    ],
    teacherGuide: "Planning scaffold only. Current implementation remains pseudo-lab plus sequence interactive.",
    fallbackMode: "Use the cup lab and sequence builder instead of a 3D scene.",
    status: "planned",
  });

  return {
    pseudoLabs: [pseudoLab],
    simulationDefinitions: [simulation],
    threeDLabDefinitions: [threeD],
  };
}

function buildLiteracySupportBundle(input: LessonLabSimulationInput): DraftBundle {
  const baseId = `${input.sourceLessonId}-literacy`;
  const pseudoLab = PseudoLabSchema.parse({
    id: `${baseId}-pseudo`,
    sourceLessonId: input.sourceLessonId,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    unitTitle: input.unitTitle,
    lessonTitle: input.lessonTitle,
    lessonObjective: input.lessonObjective,
    title: "Story Sequence Card Sort",
    objective: input.lessonObjective,
    labType: "home",
    difficulty: "intro",
    priority: "optional",
    resourceLevel: "low",
    offlineCapable: true,
    deviceRequired: "none",
    electricityRequired: false,
    riskLevel: "low",
    requiredMaterials: ["paper cards", "pencil"],
    optionalMaterials: ["family story prompt"],
    setupTimeMinutes: 3,
    runTimeMinutes: 12,
    cleanupTimeMinutes: 2,
    prepComplexity: "low",
    safetyNotes: "No special safety needs. Keep materials simple and age-appropriate.",
    setupInstructions: [
      "Write or draw three story events on paper cards.",
    ],
    procedureSteps: [
      "Learners place the cards in the most sensible order.",
      "They retell the sequence using first, next, and last.",
    ],
    expectedObservation: "Learners show improved sequence language and clearer oral retelling.",
    explanation: "This supports literacy visually without requiring specialist materials or extended guardian involvement.",
    reflectionQuestions: [
      "Which clue helped you decide what should come first?",
      "How did the order change the meaning of the story?",
    ],
    extensionIdea: "Ask learners to create one additional event card that still fits the story.",
    guardianHomeVariant: "A guardian can listen to the retelling and ask one simple question about what happened first.",
    fallbackMode: "oral_sequence",
    fallbackIfNoMaterials: "Tell the events orally and have learners arrange themselves or point to the correct order.",
    expectedCompletionTimeMinutes: 12,
    expectedSuccessRate: 0.8,
    commonConfusionSignals: ["Learner mixes event order", "Learner retells without sequence words"],
    conceptTags: ["story sequence", "retelling", "literacy support"],
    simulationType: "none",
    threeDLabReady: false,
    renderStatus: "ready",
    approved: true,
  });

  return {
    pseudoLabs: [pseudoLab],
    simulationDefinitions: [],
    threeDLabDefinitions: [],
  };
}

export function validateLab(lab: PseudoLab, input: LessonLabSimulationInput): string | null {
  if (lab.lessonObjective !== input.lessonObjective) {
    return `pseudo_lab_objective_mismatch:${lab.id}`;
  }
  if (lab.requiredMaterials.length === 0 || lab.requiredMaterials.length > 6) {
    return `pseudo_lab_materials_invalid:${lab.id}`;
  }
  if (lab.setupTimeMinutes + lab.runTimeMinutes + lab.cleanupTimeMinutes > 60) {
    return `pseudo_lab_time_exceeded:${lab.id}`;
  }
  if (!lab.fallbackIfNoMaterials.trim()) {
    return `pseudo_lab_missing_fallback:${lab.id}`;
  }
  if (!lab.fallbackMode.trim()) {
    return `pseudo_lab_missing_fallback_mode:${lab.id}`;
  }
  if (lab.riskLevel !== "low" && !lab.safetyNotes.trim()) {
    return `pseudo_lab_missing_safety:${lab.id}`;
  }
  return null;
}

function validateSimulation(
  simulation: SimulationDefinition,
  input: LessonLabSimulationInput
): string | null {
  if (simulation.lessonObjective !== input.lessonObjective) {
    return `simulation_objective_mismatch:${simulation.id}`;
  }
  if (!simulation.fallbackStaticVisual.trim()) {
    return `simulation_missing_fallback:${simulation.id}`;
  }
  return null;
}

function filterValidPseudoLabs(
  pseudoLabs: PseudoLab[],
  input: LessonLabSimulationInput
): ValidationResult<PseudoLab> {
  const valid: PseudoLab[] = [];
  const errors: string[] = [];

  for (const lab of pseudoLabs) {
    const error = validateLab(lab, input);
    if (error) {
      errors.push(error);
      continue;
    }
    valid.push(lab);
  }

  return { valid, errors };
}

function filterValidSimulations(
  simulations: SimulationDefinition[],
  input: LessonLabSimulationInput
): ValidationResult<SimulationDefinition> {
  const valid: SimulationDefinition[] = [];
  const errors: string[] = [];

  for (const simulation of simulations) {
    const error = validateSimulation(simulation, input);
    if (error) {
      errors.push(error);
      continue;
    }
    valid.push(simulation);
  }

  return { valid, errors };
}

export function generateLessonLabSimulationBundle(input: LessonLabSimulationInput): LessonLabSimulationBundle {
  const subject = normalizeSubject(input.subject);
  const lessonSignal = `${input.lessonTitle} ${input.lessonObjective}`;
  let bundle: DraftBundle = {
    pseudoLabs: [],
    simulationDefinitions: [],
    threeDLabDefinitions: [],
  };

  if (
    subject === "MATH" &&
    input.gradeLevel === 7 &&
    matchesAny(lessonSignal, ["fraction", "ratio"])
  ) {
    bundle = buildFractionBundle(input);
  } else if (
    subject === "SCIENCE" &&
    matchesAny(lessonSignal, ["evaporation", "condensation", "water cycle"])
  ) {
    bundle = buildScienceInvestigationBundle(input);
  } else if (
    subject === "SCIENCE" &&
    input.gradeLevel === 5 &&
    matchesAny(lessonSignal, ["plant", "photosynthesis"])
  ) {
    bundle = buildPhotosynthesisBundle(input);
  } else if (
    (subject === "LITERACY" || subject === "ENGLISH") &&
    input.gradeLevel <= 6 &&
    matchesAny(lessonSignal, ["sequence", "retell", "story"])
  ) {
    bundle = buildLiteracySupportBundle(input);
  }

  const validatedLabs = filterValidPseudoLabs(bundle.pseudoLabs, input);
  const validatedSimulations = filterValidSimulations(bundle.simulationDefinitions, input);

  return {
    pseudoLabs: validatedLabs.valid,
    simulationDefinitions: validatedSimulations.valid,
    threeDLabDefinitions: bundle.threeDLabDefinitions,
    generationStatus:
      validatedLabs.errors.length > 0 || validatedSimulations.errors.length > 0
        ? "deferred"
        : "ready",
    generationErrors: [...validatedLabs.errors, ...validatedSimulations.errors],
  };
}

export function generateLessonLabSimulationBundleBestEffort(
  input: LessonLabSimulationInput
): LessonLabSimulationBundle {
  try {
    return generateLessonLabSimulationBundle(input);
  } catch (error: any) {
    return {
      pseudoLabs: [],
      simulationDefinitions: [],
      threeDLabDefinitions: [],
      generationStatus: "deferred",
      generationErrors: [error?.message ?? "lab_simulation_generation_failed"],
    };
  }
}
