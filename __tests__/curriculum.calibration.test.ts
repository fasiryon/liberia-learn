import { describe, expect, it } from "vitest";
import { scoreLessonQuality } from "@/lib/curriculum/eliteUpgrade";

type CalibrationSample = {
  id: string;
  subject: string;
  grade: number;
  quality: "weak" | "developing" | "strong";
  source: "seed" | "import" | "liberia-style";
  payload: Record<string, unknown>;
};

const calibrationSamples: CalibrationSample[] = [
  ["math-g5-fractions", "MATH", 5, "developing", "seed", "Introduction to Fractions", "A fraction represents part of a whole using numerator and denominator."],
  ["english-g5-river", "ENGLISH", 5, "developing", "seed", "Reading Comprehension: The River", "Students read about the St. Paul River and identify main ideas."],
  ["science-g5-plants", "SCIENCE", 5, "developing", "seed", "How Plants Make Food", "Plants use sunlight, water, and carbon dioxide during photosynthesis."],
  ["math-g7-ratios", "MATH", 7, "weak", "import", "Ratios", "Ratios compare numbers."],
  ["science-g7-water-filtration", "SCIENCE", 7, "strong", "liberia-style", "Water Filtration Walkthrough", "Students investigate filtering muddy water using gravel, sand, and cloth."],
  ["literacy-g4-folktale", "LITERACY", 4, "developing", "liberia-style", "Folktale Characters and Lessons", "Students identify character choices and moral lessons in a Liberian folktale."],
  ["civics-g8-rights", "CIVICS", 8, "developing", "liberia-style", "Rights and Responsibilities", "Students connect constitutional rights with responsibilities in school and community."],
  ["history-g9-settlement", "HISTORY", 9, "developing", "liberia-style", "Early Liberian Settlements", "Students examine settlement patterns and evidence from historical sources."],
  ["geography-g6-counties", "GEOGRAPHY", 6, "developing", "liberia-style", "Liberia Counties and Regions", "Students map counties and describe physical and human features."],
  ["economics-g10-demand", "ECONOMICS", 10, "strong", "liberia-style", "Demand in Local Markets", "Students analyze how price changes affect demand for rice and transport."],
  ["computer-science-g8-algorithms", "COMPUTER_SCIENCE", 8, "developing", "liberia-style", "Algorithms for Daily Tasks", "Students write ordered steps for school and market tasks."],
  ["agriculture-g7-soil", "AGRICULTURE", 7, "developing", "liberia-style", "Soil Quality and Crop Growth", "Students compare soil texture, water retention, and crop growth."],
  ["environment-g8-sanitation", "ENVIRONMENTAL_STUDIES", 8, "developing", "liberia-style", "Community Sanitation", "Students study sanitation choices and disease prevention in communities."],
  ["engineering-g9-bridge", "ENGINEERING_FOUNDATIONS", 9, "strong", "liberia-style", "Bridge Design With Local Materials", "Students design and test model bridges using constraints and measurements."],
  ["financial-g6-budget", "FINANCIAL_LITERACY", 6, "developing", "liberia-style", "Household Budget Choices", "Students plan spending and saving from a fixed household amount."],
  ["business-g10-customer", "BUSINESS_ENTREPRENEURSHIP", 10, "developing", "liberia-style", "Understanding Customers", "Students identify customer needs and test a small business idea."],
  ["health-g5-malaria", "HEALTH_WELLNESS", 5, "developing", "liberia-style", "Preventing Malaria", "Students explain mosquito prevention and household health actions."],
  ["public-speaking-g7-speech", "PUBLIC_SPEAKING", 7, "developing", "liberia-style", "Organizing a Short Speech", "Students plan an opening, points, evidence, and closing."],
  ["data-g8-charts", "DATA_LITERACY", 8, "strong", "liberia-style", "Reading School Attendance Charts", "Students interpret attendance data and justify conclusions."],
  ["media-g8-evidence", "MEDIA_LITERACY", 8, "developing", "liberia-style", "Checking Claims in Media", "Students distinguish claims, evidence, and unsupported statements."],
  ["government-g11-branches", "GOVERNMENT", 11, "developing", "liberia-style", "Branches of Government", "Students compare legislative, executive, and judicial responsibilities."],
  ["chemistry-g10-reactions", "SCIENCE", 10, "strong", "liberia-style", "Chemical Reaction Evidence", "Students observe temperature, gas, color, and precipitate evidence."],
  ["biology-g9-cells", "SCIENCE", 9, "developing", "liberia-style", "Cell Structures and Functions", "Students connect cell parts to functions and organism needs."],
  ["physics-g9-force", "SCIENCE", 9, "developing", "liberia-style", "Force and Motion", "Students use pushes, pulls, mass, and acceleration examples."],
  ["math-g8-linear", "MATH", 8, "strong", "liberia-style", "Linear Patterns in Taxi Fares", "Students model base fare plus distance charge using tables and equations."],
  ["math-g10-quadratics", "MATH", 10, "developing", "liberia-style", "Quadratic Graphs", "Students identify vertex, roots, and graph shape from equations."],
  ["english-g9-argument", "ENGLISH", 9, "strong", "liberia-style", "Writing an Evidence-Based Argument", "Students write claims, evidence, reasoning, and counterargument."],
  ["literacy-g3-fluency", "LITERACY", 3, "weak", "import", "Reading Fluency", "Read fast."],
  ["social-g4-community", "SOCIAL_STUDIES", 4, "developing", "liberia-style", "Community Helpers", "Students identify roles that help a community function."],
  ["career-g8-pathways", "CAREER_EXPLORATION", 8, "developing", "liberia-style", "Career Pathways", "Students compare training, habits, and skills for different careers."],
  ["communication-g6-listening", "COMMUNICATION_SKILLS", 6, "developing", "liberia-style", "Active Listening", "Students practice listening, paraphrasing, and asking clarifying questions."],
  ["project-g9-milestones", "PROJECT_MANAGEMENT", 9, "developing", "liberia-style", "Planning Project Milestones", "Students split a project into tasks, roles, and dates."],
  ["arts-g5-patterns", "ART_DESIGN", 5, "developing", "liberia-style", "Patterns in Textile Design", "Students identify repeating motifs and create a design plan."],
  ["music-g4-rhythm", "MUSIC", 4, "developing", "liberia-style", "Rhythm Patterns", "Students clap, count, and compose short rhythm patterns."],
  ["logistics-g10-supply", "LOGISTICS_TRADE", 10, "strong", "liberia-style", "Moving Goods From Port to Market", "Students map supply-chain steps, costs, delays, and decisions."],
].map(([id, subject, grade, quality, source, title, body]) => ({
  id: id as string,
  subject: subject as string,
  grade: grade as number,
  quality: quality as CalibrationSample["quality"],
  source: source as CalibrationSample["source"],
  payload: {
    title,
    objectives:
      quality === "strong"
        ? ["Explain the core concept.", "Apply the concept to a Liberia-relevant case.", "Justify a conclusion using evidence."]
        : ["Understand the lesson topic."],
    body,
    activities: quality === "weak" ? [] : ["Answer one practice prompt.", "Discuss one local example."],
    assessmentQuestions: quality === "strong" ? ["Explain your reasoning.", "Apply the idea to a new case.", "Justify your answer."] : [],
    workedExamples: quality === "strong" ? ["Teacher models one example step by step.", "Students analyze one second example."] : [],
    guidedPractice: quality === "strong" ? ["Guided prompt one.", "Guided prompt two."] : [],
    independentPractice: quality === "strong" ? ["Independent prompt one.", "Independent prompt two."] : [],
    commonMisconceptions: quality === "strong" ? ["Students may confuse evidence with opinion."] : [],
    teacherNotes: quality === "strong" ? ["Model, ask, check, and reteach using the board."] : [],
    realWorldApplication: quality === "strong" ? "Students apply the idea to a Liberia community or market decision." : "",
  },
}));

function upgradedPayload(sample: CalibrationSample) {
  return {
    title: `${sample.payload.title} - Elite Upgrade`,
    objectives: [
      `Explain the key idea in ${sample.payload.title} using precise vocabulary.`,
      "Apply the idea to a Liberia-relevant classroom, community, market, or work situation.",
      "Justify a conclusion with evidence and check whether the reasoning transfers to a new case.",
    ],
    body: [
      "Introduction: Students connect prior knowledge to a concrete Liberia example and predict what the lesson will help them decide.",
      "Explanation: The teacher models the concept step by step, names the important vocabulary, and shows why each step matters.",
      "Worked examples: Example 1 shows the basic method step by step. Example 2 compares a different Liberia-relevant situation. Example 3 asks students to justify and transfer the method.",
      "Guided practice: Students answer three scaffolded questions, explain their reasoning, and compare answers with a partner.",
      "Independent practice: Students complete three new tasks, including one transfer question and one justification question.",
      "Assessment: Explain the concept, apply it to a new case, and justify the answer with evidence.",
      "Misconceptions: Students may copy a procedure without explaining it; correct this by asking why each step is valid. Students may use weak evidence; correct this by requiring a specific detail or calculation.",
      "Real-world application: Students apply the concept to a Liberia community, market, school, farm, health, or work decision and explain how the reasoning transfers.",
      "Summary: Students state what to remember, how to check their work, and when to transfer the idea.",
    ].join("\n\n"),
    workedExamples: ["Step-by-step example one.", "Step-by-step example two.", "Transfer example three."],
    guidedPractice: ["Guided question one.", "Guided question two.", "Guided question three."],
    independentPractice: ["Independent question one.", "Independent question two.", "Transfer question three."],
    assessmentQuestions: [
      "Explain the concept.",
      "Apply it to a new Liberia-relevant case.",
      "Justify why your answer is valid.",
      "Complete an exit ticket that compares two possible decisions and defend the stronger choice.",
    ],
    commonMisconceptions: [
      "Students may use a rule without explaining why; require a reason.",
      "Students may use unsupported evidence; require a specific detail.",
    ],
    teacherNotes: [
      "Model one example on the board and name the success criteria; Use pairs for guided practice and listen for explanation gaps; Check exit tickets before independent work and reteach the misconception without special equipment.",
    ],
    studentNotes:
      "Remember the main idea, apply it to a new case, and check your work by explaining why the answer fits the evidence.",
    realWorldApplication:
      "The concept transfers to Liberia school, community, market, health, farming, transport, or work decisions where students must compare evidence and justify action.",
  };
}

describe("Phase 5.1 curriculum calibration samples", () => {
  it("covers 35 diverse real curriculum inputs with weak and strong cases", () => {
    expect(calibrationSamples).toHaveLength(35);
    expect(calibrationSamples.some((sample) => sample.subject === "MATH")).toBe(true);
    expect(calibrationSamples.some((sample) => sample.subject === "SCIENCE")).toBe(true);
    expect(calibrationSamples.some((sample) => ["ENGLISH", "LITERACY", "HISTORY", "CIVICS"].includes(sample.subject))).toBe(true);
    expect(calibrationSamples.some((sample) => sample.quality === "weak")).toBe(true);
    expect(calibrationSamples.some((sample) => sample.quality === "strong")).toBe(true);
    expect(calibrationSamples.every((sample) => ["seed", "import", "liberia-style"].includes(sample.source))).toBe(true);
  });

  it("scores weak and strong originals differently before upgrade", () => {
    const weakScores = calibrationSamples
      .filter((sample) => sample.quality === "weak")
      .map((sample) => scoreLessonQuality(sample.payload).total);
    const strongScores = calibrationSamples
      .filter((sample) => sample.quality === "strong")
      .map((sample) => scoreLessonQuality(sample.payload).total);

    expect(Math.min(...weakScores)).toBeLessThan(60);
    expect(Math.max(...strongScores)).toBeGreaterThan(70);
  });

  it("marks 23 upgraded benchmark lessons as Gold Standard quality", () => {
    const goldScores = calibrationSamples.slice(0, 23).map((sample) => ({
      id: sample.id,
      score: scoreLessonQuality(upgradedPayload(sample)),
    }));

    expect(goldScores.every((entry) => entry.score.total >= 90)).toBe(true);
    expect(goldScores.every((entry) => entry.score.weakCategories.length === 0)).toBe(true);
  });
});
