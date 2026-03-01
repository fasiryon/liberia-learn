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
    objective: string;
    materials: string[];
    steps: string[];
    assessment: string;
    safetyNotes?: string;
  }> = [];

  const labId = `lab-${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;

  if (["MATH", "COMPUTER_SCIENCE", "ENGINEERING"].includes(subject)) {
    labs.push({
      id: `${labId}-1`,
      title: `Hands-On ${topic} Activity`,
      objective: `Students will demonstrate understanding of ${topic} through a practical exercise.`,
      materials: ["Paper", "Pencils", "Rulers", "Counters or bottle caps"],
      steps: [
        `Divide students into groups of 3-4.`,
        `Present the problem: apply ${topic} concepts to a real-world Liberian market scenario.`,
        `Each group works through the problem using physical counters or drawings.`,
        `Groups present their solutions to the class.`,
        `Class discusses different approaches and validates answers.`,
      ],
      assessment: "Observe group participation. Check written solutions for correct application of concepts.",
    });
  }

  if (["SCIENCE", "ENGINEERING"].includes(subject)) {
    labs.push({
      id: `${labId}-sci`,
      title: `${topic} Observation Lab`,
      objective: `Students will observe and record findings related to ${topic}.`,
      materials: ["Notebook", "Pencil", "Locally available materials", "Measuring tools if available"],
      steps: [
        `Teacher introduces the key concept of ${topic}.`,
        `Students make predictions about what they expect to observe.`,
        `Conduct the observation or simple experiment using local materials.`,
        `Record findings in their notebooks with drawings.`,
        `Compare predictions to actual results and discuss.`,
      ],
      assessment: "Review student notebooks for accurate observations and thoughtful comparisons.",
      safetyNotes: "Ensure students handle materials safely. Supervise any experiments closely.",
    });
  }

  if (["LITERACY", "CIVICS", "ARTS"].includes(subject)) {
    labs.push({
      id: `${labId}-lit`,
      title: `${topic} Discussion & Creative Activity`,
      objective: `Students will engage with ${topic} through discussion and creative expression.`,
      materials: ["Paper", "Colored pencils or crayons", "Reading materials"],
      steps: [
        `Read aloud or have students read a short passage related to ${topic}.`,
        `Facilitate a class discussion on key themes.`,
        `Students create a drawing, poem, or short essay responding to the topic.`,
        `Share and discuss student work.`,
      ],
      assessment: "Evaluate participation in discussion and quality of creative response.",
    });
  }

  if (labs.length === 0) {
    labs.push({
      id: `${labId}-gen`,
      title: `Exploring ${topic}`,
      objective: `Students will explore ${topic} through guided practice.`,
      materials: ["Paper", "Pencils", "Classroom resources"],
      steps: [
        `Teacher reviews key concepts of ${topic}.`,
        `Students work in pairs on practice problems or discussion questions.`,
        `Pairs share their answers with the class.`,
        `Teacher provides feedback and clarification.`,
      ],
      assessment: "Check pair work for understanding. Ask follow-up questions to assess comprehension.",
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
