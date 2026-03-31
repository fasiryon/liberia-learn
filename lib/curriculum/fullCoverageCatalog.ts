import {
  CANONICAL_SUBJECTS,
  CORE_SUBJECTS,
  type CanonicalSubjectCode,
  type SubjectTier,
} from "@/lib/curriculum/subjectTaxonomy";

export type CoverageBand = "full_year" | "semester";

export type CoverageCatalogEntry = {
  grade: number;
  subject: CanonicalSubjectCode;
  tier: SubjectTier;
  band: CoverageBand;
  unitsPerYear: number;
  lessonsPerUnit: number;
  totalLessonTarget: number;
  terms: number;
  unitThemes: string[];
};

const CORE_UNIT_THEMES: Record<CanonicalSubjectCode, string[]> = {
  MATH: [
    "Number Sense and Place Value",
    "Operations and Mental Strategies",
    "Fractions, Decimals, and Ratios",
    "Measurement and Estimation",
    "Geometry and Spatial Thinking",
    "Data and Representation",
    "Patterns, Algebra, and Functions",
    "Problem Solving and Review",
  ],
  LITERACY: [
    "Listening and Speaking",
    "Reading Fluency",
    "Vocabulary and Language",
    "Comprehension and Inference",
    "Writing and Sentence Craft",
    "Paragraphs and Text Structure",
    "Communication and Response",
    "Review and Performance",
  ],
  SCIENCE: [
    "Observation and Scientific Thinking",
    "Living Things",
    "Human Body and Health",
    "Matter and Materials",
    "Energy, Light, and Sound",
    "Earth, Water, and Weather",
    "Environment and Sustainability",
    "Science Review and Application",
  ],
  SOCIAL_STUDIES: [
    "Self, Family, and Community",
    "Places, Maps, and Direction",
    "Liberia and Local Life",
    "Culture and Heritage",
    "Citizenship and Responsibilities",
    "Work, Trade, and Daily Systems",
    "History and Sources",
    "Community Decision Making",
  ],
  CIVICS: [
    "Rules, Rights, and Duties",
    "Citizenship and Participation",
    "Institutions and Leadership",
    "Conflict Resolution and Dialogue",
    "Justice and Public Trust",
    "National Identity and Unity",
    "Media and Civic Reasoning",
    "Civic Action and Review",
  ],
  COMPUTER_SCIENCE: [],
  DIGITAL_LITERACY: [],
  ENGINEERING_FOUNDATIONS: [],
  BUSINESS_ENTREPRENEURSHIP: [],
  FINANCIAL_LITERACY: [],
  CAREER_EXPLORATION: [],
  COMMUNICATION_SKILLS: [],
  PROBLEM_SOLVING: [],
  CREATIVITY_INNOVATION: [],
  AGRICULTURE: [],
  ENVIRONMENTAL_STUDIES: [],
  AI_LITERACY: [],
  DATA_LITERACY: [],
  ENERGY_INFRASTRUCTURE: [],
};

const EXTENDED_UNIT_THEMES: Record<CanonicalSubjectCode, string[]> = {
  MATH: [],
  LITERACY: [],
  SCIENCE: [],
  SOCIAL_STUDIES: [],
  CIVICS: [],
  COMPUTER_SCIENCE: [
    "Digital Systems and Devices",
    "Algorithms and Logic",
    "Programming Foundations",
    "Data and Representation",
    "Networks and Online Systems",
    "Projects and Debugging",
  ],
  DIGITAL_LITERACY: [
    "Digital Safety",
    "Device Basics",
    "Productive Tool Use",
    "Information Search",
    "Digital Communication",
    "Responsible Participation",
  ],
  ENGINEERING_FOUNDATIONS: [
    "Design Process",
    "Structures and Stability",
    "Materials and Measurement",
    "Testing and Improvement",
    "Systems and Energy",
    "Engineering in Community Life",
  ],
  BUSINESS_ENTREPRENEURSHIP: [
    "Opportunity and Value",
    "Customers and Markets",
    "Budgeting and Costs",
    "Planning and Operations",
    "Ethics and Trust",
    "Pitching and Reflection",
  ],
  FINANCIAL_LITERACY: [
    "Money and Value",
    "Saving and Planning",
    "Budgeting",
    "Trade and Decision Making",
    "Risk and Responsibility",
    "Financial Reflection",
  ],
  CAREER_EXPLORATION: [
    "Knowing Strengths",
    "Work and Community Roles",
    "Career Pathways",
    "Skills for Work",
    "Decision Making",
    "Planning and Reflection",
  ],
  COMMUNICATION_SKILLS: [
    "Listening and Understanding",
    "Clear Speaking",
    "Writing to Inform",
    "Writing to Persuade",
    "Team Communication",
    "Presentation and Reflection",
  ],
  PROBLEM_SOLVING: [
    "Understanding Problems",
    "Planning Strategies",
    "Testing Solutions",
    "Reasoning with Evidence",
    "Applied Decisions",
    "Review and Improvement",
  ],
  CREATIVITY_INNOVATION: [
    "Curiosity and Ideas",
    "Observation and Design",
    "Creative Expression",
    "Prototyping",
    "Revision and Feedback",
    "Innovation in Community",
  ],
  AGRICULTURE: [
    "Soil and Water",
    "Seeds and Growth",
    "Crop Care",
    "Food Systems",
    "Agribusiness",
    "Sustainability",
  ],
  ENVIRONMENTAL_STUDIES: [
    "Local Environment",
    "Water and Sanitation",
    "Waste and Recycling",
    "Climate and Weather",
    "Human Impact",
    "Community Stewardship",
  ],
  AI_LITERACY: [
    "What AI Is",
    "Patterns and Data",
    "Prompting and Guidance",
    "Bias and Fairness",
    "Checking Outputs",
    "Responsible Use",
  ],
  DATA_LITERACY: [
    "Collecting Data",
    "Organizing Data",
    "Charts and Graphs",
    "Patterns and Trends",
    "Claims from Evidence",
    "Data Ethics",
  ],
  ENERGY_INFRASTRUCTURE: [
    "Energy in Daily Life",
    "Water and Power Systems",
    "Roads and Buildings",
    "Maintenance and Reliability",
    "Community Resilience",
    "Sustainable Infrastructure",
  ],
};

const EXTENDED_GRADE_RULES: Array<{
  subject: CanonicalSubjectCode;
  grades: number[];
  unitsPerYear: number;
  lessonsPerUnit: number;
}> = [
  { subject: "DIGITAL_LITERACY", grades: [1, 2, 3, 4, 5, 6], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "COMMUNICATION_SKILLS", grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "PROBLEM_SOLVING", grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "CREATIVITY_INNOVATION", grades: [1, 2, 3, 4, 5, 6, 7, 8, 9], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "CAREER_EXPLORATION", grades: [4, 5, 6, 7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "FINANCIAL_LITERACY", grades: [4, 5, 6, 7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "ENVIRONMENTAL_STUDIES", grades: [4, 5, 6, 7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "AGRICULTURE", grades: [4, 5, 6, 7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "COMPUTER_SCIENCE", grades: [7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "ENGINEERING_FOUNDATIONS", grades: [7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "DATA_LITERACY", grades: [7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "AI_LITERACY", grades: [7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "BUSINESS_ENTREPRENEURSHIP", grades: [7, 8, 9, 10, 11, 12], unitsPerYear: 6, lessonsPerUnit: 5 },
  { subject: "ENERGY_INFRASTRUCTURE", grades: [7, 8, 9, 10, 11, 12], unitsPerYear: 4, lessonsPerUnit: 5 },
];

function buildCoreEntries(): CoverageCatalogEntry[] {
  const grades = Array.from({ length: 12 }, (_, index) => index + 1);
  return grades.flatMap((grade) =>
    CORE_SUBJECTS.map((subject) => ({
      grade,
      subject: subject.code,
      tier: "core" as const,
      band: "full_year" as const,
      unitsPerYear: 8,
      lessonsPerUnit: 5,
      totalLessonTarget: 40,
      terms: 3,
      unitThemes: CORE_UNIT_THEMES[subject.code],
    }))
  );
}

function buildExtendedEntries(): CoverageCatalogEntry[] {
  return EXTENDED_GRADE_RULES.flatMap((rule) =>
    rule.grades.map((grade) => ({
      grade,
      subject: rule.subject,
      tier: "extended" as const,
      band: "semester" as const,
      unitsPerYear: rule.unitsPerYear,
      lessonsPerUnit: rule.lessonsPerUnit,
      totalLessonTarget: rule.unitsPerYear * rule.lessonsPerUnit,
      terms: grade >= 7 ? 3 : 2,
      unitThemes: EXTENDED_UNIT_THEMES[rule.subject],
    }))
  );
}

export const FULL_COVERAGE_CATALOG: CoverageCatalogEntry[] = [
  ...buildCoreEntries(),
  ...buildExtendedEntries(),
];

export function listCoverageEntries(options?: {
  grade?: number;
  subject?: CanonicalSubjectCode;
  tier?: SubjectTier;
}) {
  return FULL_COVERAGE_CATALOG.filter((entry) => {
    if (options?.grade != null && entry.grade !== options.grade) return false;
    if (options?.subject != null && entry.subject !== options.subject) return false;
    if (options?.tier != null && entry.tier !== options.tier) return false;
    return true;
  });
}

export function summarizeCoverageCatalog() {
  const bySubject = new Map<CanonicalSubjectCode, number>();
  const byGrade = new Map<number, number>();

  for (const entry of FULL_COVERAGE_CATALOG) {
    bySubject.set(entry.subject, (bySubject.get(entry.subject) ?? 0) + entry.totalLessonTarget);
    byGrade.set(entry.grade, (byGrade.get(entry.grade) ?? 0) + entry.totalLessonTarget);
  }

  return {
    subjects: CANONICAL_SUBJECTS.length,
    catalogEntries: FULL_COVERAGE_CATALOG.length,
    totalLessonTarget: FULL_COVERAGE_CATALOG.reduce((sum, entry) => sum + entry.totalLessonTarget, 0),
    coreLessonTarget: FULL_COVERAGE_CATALOG.filter((entry) => entry.tier === "core").reduce(
      (sum, entry) => sum + entry.totalLessonTarget,
      0
    ),
    bySubject: Object.fromEntries([...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byGrade: Object.fromEntries([...byGrade.entries()].sort((a, b) => a[0] - b[0])),
  };
}
