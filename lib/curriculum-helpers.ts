import { liberianize } from "@/lib/localization/liberia-context";
import { standardizeTone } from "@/lib/localization/tone-standardizer";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Generate 1-3 lab objects for the given grade/subject/topic */
export function generateLabs(grade: number, subject: string, topic: string) {
  const labs: Array<{
    id: string;
    title: string;
    type: "guided_walkthrough" | "2d_simulation" | "3d_environment";
    durationMinutes: number;
    subject: string;
    gradeLevel: number;
    labObjective: string;
    materialsNeeded: string[];
    safetyNotes: string | null;
    procedure: Array<{
      stepNumber: number;
      instruction: string;
      teacherNote: string | null;
      durationMinutes: number;
    }>;
    observationForm: Array<{
      field: string;
      prompt: string;
      inputType: "text" | "number" | "choice";
      choices: string[] | null;
    }>;
    analysisQuestions: Array<{
      question: string;
      expectedAnswer: string;
      scoringRubric: string;
    }>;
    connectionToLesson: string;
    offlineCapable: boolean;
    virtualAlternative: string | null;
  }> = [];

  const labId = `lab-${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;

  if (subject === "MATH" && grade < 7) {
    return [];
  }

  if (["CIVICS", "ARTS", "PE", "CAREER"].includes(subject)) {
    return [];
  }

  const buildLocalLab = (params: {
    idSuffix: string;
    title: string;
    objective: string;
    materials: string[];
    safetyNotes?: string | null;
    steps: Array<{ instruction: string; teacherNote?: string | null; durationMinutes: number }>;
    observationForm: Array<{ field: string; prompt: string; inputType: "text" | "number" | "choice"; choices?: string[] | null }>;
    analysisQuestions: Array<{ question: string; expectedAnswer: string; scoringRubric: string }>;
    connectionToLesson: string;
    virtualAlternative?: string | null;
  }) => ({
    id: `${labId}-${params.idSuffix}`,
    title: params.title,
    type: "guided_walkthrough" as const,
    durationMinutes: params.steps.reduce((sum, step) => sum + step.durationMinutes, 0),
    subject,
    gradeLevel: grade,
    labObjective: params.objective,
    materialsNeeded: params.materials,
    safetyNotes: params.safetyNotes ?? null,
    procedure: params.steps.map((step, index) => ({
      stepNumber: index + 1,
      instruction: step.instruction,
      teacherNote: step.teacherNote ?? null,
      durationMinutes: step.durationMinutes,
    })),
    observationForm: params.observationForm.map((field) => ({
      field: field.field,
      prompt: field.prompt,
      inputType: field.inputType,
      choices: field.choices ?? null,
    })),
    analysisQuestions: params.analysisQuestions,
    connectionToLesson: params.connectionToLesson,
    offlineCapable: true,
    virtualAlternative: params.virtualAlternative ?? null,
  });

  if (["MATH", "COMPUTER_SCIENCE", "ENGINEERING"].includes(subject)) {
    labs.push({
      ...buildLocalLab({
      idSuffix: "1",
      title: `Hands-On ${topic} Activity`,
      objective: `Students will demonstrate understanding of ${topic} through a practical exercise grounded in Liberian daily life.`,
      materials: ["Paper", "Pencils", "Rulers", "Bottle caps", "String"],
      steps: [
        { instruction: "Divide students into groups of 3-4 and assign each group a recorder.", teacherNote: "Ensure each group has paper and bottle caps.", durationMinutes: 4 },
        { instruction: `Present a real Liberian market or workshop problem that requires ${topic}.`, teacherNote: "Use prices, measurements, or counts familiar to students.", durationMinutes: 6 },
        { instruction: "Students model the problem using bottle caps, string, drawings, or measurement marks.", teacherNote: "Prompt students to explain each step aloud.", durationMinutes: 8 },
        { instruction: "Groups compare solutions and refine their reasoning.", teacherNote: "Watch for misconceptions and ask probing questions.", durationMinutes: 5 },
        { instruction: "Each group shares one finding with the class.", teacherNote: "Capture strong explanations on the board.", durationMinutes: 4 },
      ],
      observationForm: [
        { field: "strategy_used", prompt: "What strategy did your group use to solve the task?", inputType: "text" },
        { field: "result_value", prompt: "What answer or measurement did your group find?", inputType: "number" },
        { field: "confidence_level", prompt: "How confident is your group in the result?", inputType: "choice", choices: ["Low", "Medium", "High"] },
      ],
      analysisQuestions: [
        {
          question: `How did the materials help you understand ${topic}?`,
          expectedAnswer: "Students describe how the concrete model showed the concept clearly.",
          scoringRubric: "Full credit for a specific explanation linking the materials to the mathematical or design concept.",
        },
        {
          question: "What mistake could another group make on this task, and how would you correct it?",
          expectedAnswer: "Students identify a likely misconception and explain the correction.",
          scoringRubric: "Full credit for naming a realistic error and a correct fix.",
        },
      ],
      connectionToLesson: `This lab gives students a concrete way to apply ${topic} before they move to formal classwork.`,
      virtualAlternative: `If materials are limited, the teacher can use a cached 2D simulation or projected drawing to model ${topic}.`,
      }),
    });
  }

  if (["SCIENCE", "ENGINEERING"].includes(subject)) {
    labs.push({
      ...buildLocalLab({
      idSuffix: "sci",
      title: `${topic} Observation Lab`,
      objective: `Students will observe and record findings related to ${topic} using locally available materials.`,
      materials: ["Notebook", "Pencil", "Leaves", "Water", "Stones", "String"],
      safetyNotes: "Ensure students handle water and natural materials safely and wash hands after the activity.",
      steps: [
        { instruction: `Introduce the observation focus for ${topic} and explain the investigation question.`, teacherNote: "Ask students to predict what they expect to notice.", durationMinutes: 5 },
        { instruction: "Students gather or arrange the local materials needed for the investigation.", teacherNote: "Model safe handling and shared use of materials.", durationMinutes: 4 },
        { instruction: "Students carry out the observation and record what changes or patterns they notice.", teacherNote: "Encourage labelled drawings and measurements.", durationMinutes: 10 },
        { instruction: "Pairs compare notes and identify one important finding.", teacherNote: "Prompt them to use lesson vocabulary.", durationMinutes: 5 },
        { instruction: "Class debrief on what the investigation shows.", teacherNote: "Connect the observations back to the main science idea.", durationMinutes: 4 },
      ],
      observationForm: [
        { field: "prediction", prompt: "What did you predict would happen?", inputType: "text" },
        { field: "observed_change", prompt: "What did you observe during the investigation?", inputType: "text" },
        { field: "measurement", prompt: "Record one measurement or count from the lab.", inputType: "number" },
      ],
      analysisQuestions: [
        {
          question: "What evidence from the lab supports the lesson concept?",
          expectedAnswer: "Students cite an observation or measurement that connects to the concept.",
          scoringRubric: "Full credit for a clear link between evidence and the scientific idea.",
        },
        {
          question: "How would you improve this investigation next time?",
          expectedAnswer: "Students suggest a realistic improvement such as more careful measurement or more trials.",
          scoringRubric: "Full credit for a specific improvement tied to better evidence.",
        },
      ],
      connectionToLesson: `This lab makes ${topic} visible and discussable through direct observation.`,
      virtualAlternative: "If a device is available, students can compare their observations to a simple cached 2D simulation.",
      }),
    });
  }

  if (subject === "LITERACY") {
    labs.push({
      ...buildLocalLab({
      idSuffix: "lit",
      title: `${topic} Discussion & Creative Activity`,
      objective: `Students will investigate ${topic} through reading, discussion, and writing.`,
      materials: ["Paper", "Pencil", "Reading passage", "Notebook"],
      steps: [
        { instruction: `Read or listen to a short passage connected to ${topic}.`, teacherNote: "Pause to clarify unfamiliar words.", durationMinutes: 5 },
        { instruction: "Students annotate or list key details from the passage.", teacherNote: "Model one example detail on the board.", durationMinutes: 6 },
        { instruction: "Pairs discuss what the text suggests and gather evidence.", teacherNote: "Encourage students to quote or paraphrase accurately.", durationMinutes: 7 },
        { instruction: "Students write a brief response or paragraph using their evidence.", teacherNote: "Support sentence starters for struggling writers.", durationMinutes: 8 },
        { instruction: "Invite a few students to share and compare ideas.", teacherNote: "Highlight strong use of evidence.", durationMinutes: 4 },
      ],
      observationForm: [
        { field: "key_detail", prompt: "Write one important detail from the text.", inputType: "text" },
        { field: "evidence_used", prompt: "What evidence did you use in your response?", inputType: "text" },
        { field: "text_clarity", prompt: "How easy was the passage to understand?", inputType: "choice", choices: ["Hard", "Okay", "Easy"] },
      ],
      analysisQuestions: [
        {
          question: "What did the investigation help you understand about the text?",
          expectedAnswer: "Students explain a theme, idea, or craft move supported by evidence.",
          scoringRubric: "Full credit for a clear claim supported by a relevant detail.",
        },
        {
          question: "How could you strengthen your written response?",
          expectedAnswer: "Students mention adding evidence, clearer explanation, or stronger vocabulary.",
          scoringRubric: "Full credit for identifying a practical revision move.",
        },
      ],
      connectionToLesson: `This writing workshop extends the lesson by making students collect evidence and explain their thinking.`,
      virtualAlternative: "If devices are available, students can compare notes in a shared offline writing board.",
      }),
    });
  }

  return labs;
}

/** 13-week term plan structure */
export function generateTermPlanPayload(grade: number, subject: string, topic: string) {
  const weeks = Array.from({ length: 13 }, (_, i) => ({
    week: i + 1,
    topic: i === 0 ? topic : `${topic} - Week ${i + 1}`,
    objectives: [`Objective for week ${i + 1}`],
    activities: [`Activity for week ${i + 1}`],
  }));
  return {
    title: `Term Plan: ${topic} (Grade ${grade})`,
    grade,
    subject,
    type: "term_plan",
    weeks,
    metadata: { topic, locale: "LR", generatedAt: new Date().toISOString() },
  };
}

/** 2-week unit plan structure */
export function generateUnitPlanPayload(grade: number, subject: string, topic: string) {
  return {
    title: `Unit Plan: ${topic} (Grade ${grade})`,
    grade,
    subject,
    type: "unit_plan",
    duration: "2 weeks",
    objectives: [
      `Students will understand the fundamentals of ${topic}.`,
      `Students will apply ${topic} concepts to solve problems.`,
      `Students will demonstrate mastery through assessment.`,
    ],
    lessons: [
      { day: 1, title: `Introduction to ${topic}`, focus: "Core concepts" },
      { day: 2, title: `${topic} Practice`, focus: "Guided practice" },
      { day: 3, title: `${topic} Application`, focus: "Real-world problems" },
      { day: 4, title: `${topic} Lab`, focus: "Hands-on activity" },
      { day: 5, title: `${topic} Review & Assessment`, focus: "Assessment" },
    ],
    assessment: {
      formative: ["Daily exit tickets", "Group presentations"],
      summative: ["End-of-unit test", "Project submission"],
    },
    metadata: { topic, locale: "LR", generatedAt: new Date().toISOString() },
  };
}

/** Generate 5 MCQ assessment items for a unit topic */
export function generateAssessmentItems(
  grade: number,
  subject: string,
  unitTopic: string,
  moeAlignmentCodes: string[] = []
) {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: `assess-${slugify(unitTopic)}-q${i + 1}`,
    question: standardizeTone(
      liberianize(`Question ${i + 1}: What is a key concept of ${unitTopic}?`),
      grade
    ),
    type: "MCQ",
    options: [
      { label: "A", text: `Correct answer about ${unitTopic}` },
      { label: "B", text: `Distractor option 1` },
      { label: "C", text: `Distractor option 2` },
      { label: "D", text: `Distractor option 3` },
    ],
    correctAnswer: "A",
    points: 2,
    standardCodes: moeAlignmentCodes,
  }));
  return items;
}

/** Generate a rubric for an assessment */
export function generateRubric(title: string, moeAlignmentCodes: string[] = []) {
  return {
    title: `Rubric: ${title}`,
    criteria: [
      {
        name: "Understanding",
        standardCodes: moeAlignmentCodes,
        levels: [
          { label: "Excellent", points: 4, description: "Demonstrates thorough understanding of all concepts." },
          { label: "Good", points: 3, description: "Demonstrates solid understanding of most concepts." },
          { label: "Developing", points: 2, description: "Shows basic understanding with some gaps." },
          { label: "Beginning", points: 1, description: "Limited understanding of key concepts." },
        ],
      },
      {
        name: "Application",
        standardCodes: moeAlignmentCodes,
        levels: [
          { label: "Excellent", points: 4, description: "Applies concepts accurately to new situations." },
          { label: "Good", points: 3, description: "Applies concepts with minor errors." },
          { label: "Developing", points: 2, description: "Attempts application but with significant errors." },
          { label: "Beginning", points: 1, description: "Unable to apply concepts independently." },
        ],
      },
      {
        name: "Communication",
        standardCodes: moeAlignmentCodes,
        levels: [
          { label: "Excellent", points: 4, description: "Explains reasoning clearly and completely." },
          { label: "Good", points: 3, description: "Explains reasoning adequately." },
          { label: "Developing", points: 2, description: "Explanation is incomplete or unclear." },
          { label: "Beginning", points: 1, description: "Unable to explain reasoning." },
        ],
      },
    ],
    totalPossible: 12,
  };
}

/** Generate mastery check items for a unit */
export function generateMasteryChecks(grade: number, subject: string, unitTopic: string) {
  return [
    {
      id: `mastery-${slugify(unitTopic)}-1`,
      skill: `Recall key facts about ${unitTopic}`,
      prompt: standardizeTone(
        liberianize(`Can you list three important things about ${unitTopic}?`),
        grade
      ),
      passThreshold: "Student names at least 2 of 3 key concepts.",
    },
    {
      id: `mastery-${slugify(unitTopic)}-2`,
      skill: `Apply ${unitTopic} concepts`,
      prompt: standardizeTone(
        liberianize(`Show how ${unitTopic} works in a real-life situation in Liberia.`),
        grade
      ),
      passThreshold: "Student provides a relevant real-world example with correct reasoning.",
    },
    {
      id: `mastery-${slugify(unitTopic)}-3`,
      skill: `Explain ${unitTopic} to a peer`,
      prompt: standardizeTone(
        liberianize(`Explain ${unitTopic} to a classmate who missed the lesson.`),
        grade
      ),
      passThreshold: "Student explains the concept clearly using appropriate vocabulary.",
    },
  ];
}
