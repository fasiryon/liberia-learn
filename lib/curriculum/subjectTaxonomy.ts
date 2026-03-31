export type CanonicalSubjectCode =
  | "MATH"
  | "LITERACY"
  | "SCIENCE"
  | "SOCIAL_STUDIES"
  | "CIVICS"
  | "COMPUTER_SCIENCE"
  | "DIGITAL_LITERACY"
  | "ENGINEERING_FOUNDATIONS"
  | "BUSINESS_ENTREPRENEURSHIP"
  | "FINANCIAL_LITERACY"
  | "CAREER_EXPLORATION"
  | "COMMUNICATION_SKILLS"
  | "PROBLEM_SOLVING"
  | "CREATIVITY_INNOVATION"
  | "AGRICULTURE"
  | "ENVIRONMENTAL_STUDIES"
  | "AI_LITERACY"
  | "DATA_LITERACY"
  | "ENERGY_INFRASTRUCTURE";

export type SubjectTier = "core" | "extended";

export type CanonicalSubjectDefinition = {
  code: CanonicalSubjectCode;
  displayName: string;
  tier: SubjectTier;
  aliases: string[];
  storageSubject: string;
};

const DEFINITIONS: CanonicalSubjectDefinition[] = [
  {
    code: "MATH",
    displayName: "Mathematics",
    tier: "core",
    aliases: ["MATHEMATICS", "MATHS"],
    storageSubject: "MATH",
  },
  {
    code: "LITERACY",
    displayName: "English / Literacy",
    tier: "core",
    aliases: [
      "ENGLISH",
      "ENGLISH_LANGUAGE_ARTS",
      "ENGLISH LANGUAGE ARTS",
      "LANGUAGE_ARTS",
      "READING",
      "ELA",
    ],
    storageSubject: "LITERACY",
  },
  {
    code: "SCIENCE",
    displayName: "Science",
    tier: "core",
    aliases: ["INTEGRATED_SCIENCE", "GENERAL_SCIENCE"],
    storageSubject: "SCIENCE",
  },
  {
    code: "SOCIAL_STUDIES",
    displayName: "Social Studies",
    tier: "core",
    aliases: ["SOCIAL STUDIES", "SOCIALSTUDIES"],
    storageSubject: "SOCIAL_STUDIES",
  },
  {
    code: "CIVICS",
    displayName: "Civics",
    tier: "core",
    aliases: ["GOVERNMENT", "CITIZENSHIP"],
    storageSubject: "CIVICS",
  },
  {
    code: "COMPUTER_SCIENCE",
    displayName: "Computer Science",
    tier: "extended",
    aliases: ["ICT", "INFORMATION_TECHNOLOGY", "INFORMATION TECHNOLOGY"],
    storageSubject: "COMPUTER_SCIENCE",
  },
  {
    code: "DIGITAL_LITERACY",
    displayName: "Digital Literacy",
    tier: "extended",
    aliases: ["DIGITAL SKILLS"],
    storageSubject: "DIGITAL_LITERACY",
  },
  {
    code: "ENGINEERING_FOUNDATIONS",
    displayName: "Engineering Foundations",
    tier: "extended",
    aliases: ["ENGINEERING", "FOUNDATIONS_OF_ENGINEERING"],
    storageSubject: "ENGINEERING_FOUNDATIONS",
  },
  {
    code: "BUSINESS_ENTREPRENEURSHIP",
    displayName: "Business / Entrepreneurship",
    tier: "extended",
    aliases: ["BUSINESS", "ENTREPRENEURSHIP", "BUSINESS_STUDIES"],
    storageSubject: "BUSINESS_ENTREPRENEURSHIP",
  },
  {
    code: "FINANCIAL_LITERACY",
    displayName: "Financial Literacy",
    tier: "extended",
    aliases: ["FINANCE", "PERSONAL_FINANCE"],
    storageSubject: "FINANCIAL_LITERACY",
  },
  {
    code: "CAREER_EXPLORATION",
    displayName: "Career Exploration",
    tier: "extended",
    aliases: ["CAREER", "CAREERS", "WORK_READINESS"],
    storageSubject: "CAREER_EXPLORATION",
  },
  {
    code: "COMMUNICATION_SKILLS",
    displayName: "Communication Skills",
    tier: "extended",
    aliases: ["COMMUNICATION", "SPEAKING_LISTENING"],
    storageSubject: "COMMUNICATION_SKILLS",
  },
  {
    code: "PROBLEM_SOLVING",
    displayName: "Problem Solving",
    tier: "extended",
    aliases: ["CRITICAL_THINKING"],
    storageSubject: "PROBLEM_SOLVING",
  },
  {
    code: "CREATIVITY_INNOVATION",
    displayName: "Creativity / Innovation",
    tier: "extended",
    aliases: ["CREATIVITY", "INNOVATION", "DESIGN_THINKING"],
    storageSubject: "CREATIVITY_INNOVATION",
  },
  {
    code: "AGRICULTURE",
    displayName: "Agriculture",
    tier: "extended",
    aliases: ["AGRI_SCIENCE", "AGRIC_SCIENCE"],
    storageSubject: "AGRICULTURE",
  },
  {
    code: "ENVIRONMENTAL_STUDIES",
    displayName: "Environmental Studies",
    tier: "extended",
    aliases: ["ENVIRONMENT", "ENVIRONMENTAL_SCIENCE"],
    storageSubject: "ENVIRONMENTAL_STUDIES",
  },
  {
    code: "AI_LITERACY",
    displayName: "AI Literacy",
    tier: "extended",
    aliases: ["ARTIFICIAL_INTELLIGENCE_LITERACY", "AI"],
    storageSubject: "AI_LITERACY",
  },
  {
    code: "DATA_LITERACY",
    displayName: "Data Literacy",
    tier: "extended",
    aliases: ["DATA", "DATA_SKILLS"],
    storageSubject: "DATA_LITERACY",
  },
  {
    code: "ENERGY_INFRASTRUCTURE",
    displayName: "Energy / Infrastructure",
    tier: "extended",
    aliases: ["INFRASTRUCTURE", "ENERGY", "ENERGY_AND_INFRASTRUCTURE"],
    storageSubject: "ENERGY_INFRASTRUCTURE",
  },
];

const LOOKUP = new Map<string, CanonicalSubjectDefinition>();
for (const definition of DEFINITIONS) {
  LOOKUP.set(definition.code, definition);
  LOOKUP.set(definition.displayName.toUpperCase(), definition);
  for (const alias of definition.aliases) {
    LOOKUP.set(alias.toUpperCase(), definition);
  }
}

export const CANONICAL_SUBJECTS = DEFINITIONS;
export const CORE_SUBJECTS = DEFINITIONS.filter((definition) => definition.tier === "core");
export const EXTENDED_SUBJECTS = DEFINITIONS.filter((definition) => definition.tier === "extended");

export function normalizeSubject(input: string): CanonicalSubjectDefinition | null {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, "_");
  return LOOKUP.get(normalized) ?? null;
}

export function requireCanonicalSubject(input: string): CanonicalSubjectDefinition {
  const definition = normalizeSubject(input);
  if (!definition) {
    throw new Error(`Unknown curriculum subject: ${input}`);
  }

  return definition;
}

export function getCanonicalSubjectCode(input: string): CanonicalSubjectCode | null {
  return normalizeSubject(input)?.code ?? null;
}

export function getStorageSubject(input: string): string | null {
  return normalizeSubject(input)?.storageSubject ?? null;
}
