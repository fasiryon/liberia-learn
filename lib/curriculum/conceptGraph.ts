import type { CanonicalSubjectCode } from "@/lib/curriculum/subjectTaxonomy";

export type DifficultyLevel = "intro" | "standard" | "advanced";

export type ConceptNode = {
  id: string;
  subject: CanonicalSubjectCode;
  label: string;
  minGrade: number;
  prerequisites: string[];
  nextConcepts: string[];
  keywords: string[];
};

type LessonConceptInput = {
  subject: string;
  grade: number;
  unitTitle: string;
  lessonTitle: string;
  orderInUnit: number;
};

export type InferredConceptMetadata = {
  primaryConcept: string;
  prerequisites: string[];
  nextConcepts: string[];
  difficulty: DifficultyLevel;
};

function makeNodes(
  subject: CanonicalSubjectCode,
  nodes: Array<Omit<ConceptNode, "subject" | "minGrade"> & { minGrade?: number }>
): ConceptNode[] {
  return nodes.map((node) => ({ ...node, subject, minGrade: node.minGrade ?? 1 }));
}

const SUBJECT_CONCEPT_GRAPHS: Record<CanonicalSubjectCode, ConceptNode[]> = {
  MATH: makeNodes("MATH", [
    {
      id: "number_sense",
      label: "Number Sense and Place Value",
      prerequisites: [],
      nextConcepts: ["operations"],
      keywords: ["number sense", "place value"],
    },
    {
      id: "operations",
      label: "Operations and Mental Strategies",
      prerequisites: ["number_sense"],
      nextConcepts: ["fractions_decimals_ratio"],
      keywords: ["operations", "mental strategies"],
    },
    {
      id: "fractions_decimals_ratio",
      label: "Fractions, Decimals, and Ratios",
      prerequisites: ["operations"],
      nextConcepts: ["measurement_estimation"],
      keywords: ["fractions", "decimals", "ratios"],
    },
    {
      id: "measurement_estimation",
      label: "Measurement and Estimation",
      prerequisites: ["number_sense", "operations"],
      nextConcepts: ["geometry_spatial"],
      keywords: ["measurement", "estimation"],
    },
    {
      id: "geometry_spatial",
      label: "Geometry and Spatial Thinking",
      prerequisites: ["number_sense"],
      nextConcepts: ["data_representation"],
      keywords: ["geometry", "spatial"],
    },
    {
      id: "data_representation",
      label: "Data and Representation",
      prerequisites: ["number_sense"],
      nextConcepts: ["patterns_algebra_functions"],
      keywords: ["data", "representation"],
    },
    {
      id: "patterns_algebra_functions",
      label: "Patterns, Algebra, and Functions",
      prerequisites: ["operations", "fractions_decimals_ratio"],
      nextConcepts: ["problem_solving_review_math"],
      keywords: ["patterns", "algebra", "functions"],
    },
    {
      id: "problem_solving_review_math",
      label: "Problem Solving and Review",
      prerequisites: ["patterns_algebra_functions"],
      nextConcepts: [],
      keywords: ["problem solving", "review"],
    },
  ]),
  LITERACY: makeNodes("LITERACY", [
    {
      id: "oral_language",
      label: "Listening and Speaking",
      prerequisites: [],
      nextConcepts: ["reading_fluency"],
      keywords: ["listening", "speaking"],
    },
    {
      id: "reading_fluency",
      label: "Reading Fluency",
      prerequisites: ["oral_language"],
      nextConcepts: ["vocabulary_language"],
      keywords: ["reading fluency"],
    },
    {
      id: "vocabulary_language",
      label: "Vocabulary and Language",
      prerequisites: ["reading_fluency"],
      nextConcepts: ["comprehension_inference"],
      keywords: ["vocabulary", "language"],
    },
    {
      id: "comprehension_inference",
      label: "Comprehension and Inference",
      prerequisites: ["reading_fluency", "vocabulary_language"],
      nextConcepts: ["sentence_craft"],
      keywords: ["comprehension", "inference"],
    },
    {
      id: "sentence_craft",
      label: "Writing and Sentence Craft",
      prerequisites: ["oral_language"],
      nextConcepts: ["paragraph_structure"],
      keywords: ["writing", "sentence craft"],
    },
    {
      id: "paragraph_structure",
      label: "Paragraphs and Text Structure",
      prerequisites: ["sentence_craft", "comprehension_inference"],
      nextConcepts: ["communication_response"],
      keywords: ["paragraphs", "text structure"],
    },
    {
      id: "communication_response",
      label: "Communication and Response",
      prerequisites: ["paragraph_structure"],
      nextConcepts: ["review_performance_literacy"],
      keywords: ["communication", "response"],
    },
    {
      id: "review_performance_literacy",
      label: "Review and Performance",
      prerequisites: ["communication_response"],
      nextConcepts: [],
      keywords: ["review", "performance"],
    },
  ]),
  SCIENCE: makeNodes("SCIENCE", [
    {
      id: "scientific_observation",
      label: "Observation and Scientific Thinking",
      prerequisites: [],
      nextConcepts: ["living_things"],
      keywords: ["observation", "scientific thinking"],
    },
    {
      id: "living_things",
      label: "Living Things",
      prerequisites: ["scientific_observation"],
      nextConcepts: ["body_health"],
      keywords: ["living things"],
    },
    {
      id: "body_health",
      label: "Human Body and Health",
      prerequisites: ["living_things"],
      nextConcepts: ["matter_materials"],
      keywords: ["human body", "health"],
    },
    {
      id: "matter_materials",
      label: "Matter and Materials",
      prerequisites: ["scientific_observation"],
      nextConcepts: ["energy_light_sound"],
      keywords: ["matter", "materials"],
    },
    {
      id: "energy_light_sound",
      label: "Energy, Light, and Sound",
      prerequisites: ["matter_materials"],
      nextConcepts: ["earth_water_weather"],
      keywords: ["energy", "light", "sound"],
    },
    {
      id: "earth_water_weather",
      label: "Earth, Water, and Weather",
      prerequisites: ["scientific_observation"],
      nextConcepts: ["environment_sustainability"],
      keywords: ["earth", "water", "weather"],
    },
    {
      id: "environment_sustainability",
      label: "Environment and Sustainability",
      prerequisites: ["living_things", "earth_water_weather"],
      nextConcepts: ["science_application"],
      keywords: ["environment", "sustainability"],
    },
    {
      id: "science_application",
      label: "Science Review and Application",
      prerequisites: ["environment_sustainability"],
      nextConcepts: [],
      keywords: ["review", "application"],
    },
  ]),
  SOCIAL_STUDIES: makeNodes("SOCIAL_STUDIES", [
    {
      id: "identity_community",
      label: "Self, Family, and Community",
      prerequisites: [],
      nextConcepts: ["maps_places"],
      keywords: ["self", "family", "community"],
    },
    {
      id: "maps_places",
      label: "Places, Maps, and Direction",
      prerequisites: ["identity_community"],
      nextConcepts: ["liberia_local_life"],
      keywords: ["maps", "places", "direction"],
    },
    {
      id: "liberia_local_life",
      label: "Liberia and Local Life",
      prerequisites: ["identity_community"],
      nextConcepts: ["culture_heritage"],
      keywords: ["liberia", "local life"],
    },
    {
      id: "culture_heritage",
      label: "Culture and Heritage",
      prerequisites: ["liberia_local_life"],
      nextConcepts: ["citizenship_responsibilities"],
      keywords: ["culture", "heritage"],
    },
    {
      id: "citizenship_responsibilities",
      label: "Citizenship and Responsibilities",
      prerequisites: ["identity_community"],
      nextConcepts: ["work_trade"],
      keywords: ["citizenship", "responsibilities"],
    },
    {
      id: "work_trade",
      label: "Work, Trade, and Daily Systems",
      prerequisites: ["citizenship_responsibilities"],
      nextConcepts: ["history_sources"],
      keywords: ["work", "trade"],
    },
    {
      id: "history_sources",
      label: "History and Sources",
      prerequisites: ["culture_heritage"],
      nextConcepts: ["community_decision_making"],
      keywords: ["history", "sources"],
    },
    {
      id: "community_decision_making",
      label: "Community Decision Making",
      prerequisites: ["citizenship_responsibilities", "work_trade"],
      nextConcepts: [],
      keywords: ["decision making"],
    },
  ]),
  CIVICS: makeNodes("CIVICS", [
    {
      id: "rules_rights_duties",
      label: "Rules, Rights, and Duties",
      prerequisites: [],
      nextConcepts: ["citizenship_participation"],
      keywords: ["rules", "rights", "duties"],
    },
    {
      id: "citizenship_participation",
      label: "Citizenship and Participation",
      prerequisites: ["rules_rights_duties"],
      nextConcepts: ["institutions_leadership"],
      keywords: ["citizenship", "participation"],
    },
    {
      id: "institutions_leadership",
      label: "Institutions and Leadership",
      prerequisites: ["citizenship_participation"],
      nextConcepts: ["conflict_dialogue"],
      keywords: ["institutions", "leadership"],
    },
    {
      id: "conflict_dialogue",
      label: "Conflict Resolution and Dialogue",
      prerequisites: ["citizenship_participation"],
      nextConcepts: ["justice_public_trust"],
      keywords: ["conflict", "dialogue"],
    },
    {
      id: "justice_public_trust",
      label: "Justice and Public Trust",
      prerequisites: ["institutions_leadership"],
      nextConcepts: ["national_identity_unity"],
      keywords: ["justice", "public trust"],
    },
    {
      id: "national_identity_unity",
      label: "National Identity and Unity",
      prerequisites: ["citizenship_participation"],
      nextConcepts: ["media_civic_reasoning"],
      keywords: ["national identity", "unity"],
    },
    {
      id: "media_civic_reasoning",
      label: "Media and Civic Reasoning",
      prerequisites: ["justice_public_trust"],
      nextConcepts: ["civic_action_review"],
      keywords: ["media", "civic reasoning"],
    },
    {
      id: "civic_action_review",
      label: "Civic Action and Review",
      prerequisites: ["media_civic_reasoning", "national_identity_unity"],
      nextConcepts: [],
      keywords: ["civic action", "review"],
    },
  ]),
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

function normalizeSubjectKey(subject: string): CanonicalSubjectCode | null {
  const normalized = subject.trim().toUpperCase().replace(/\s+/g, "_");
  return normalized in SUBJECT_CONCEPT_GRAPHS
    ? (normalized as CanonicalSubjectCode)
    : normalized === "ENGLISH"
      ? "LITERACY"
      : null;
}

function difficultyForOrder(orderInUnit: number): DifficultyLevel {
  if (orderInUnit <= 1) return "intro";
  if (orderInUnit >= 5) return "advanced";
  return "standard";
}

export function getSubjectConceptGraph(subject: string) {
  const key = normalizeSubjectKey(subject);
  return key ? SUBJECT_CONCEPT_GRAPHS[key] ?? [] : [];
}

export function summarizeConceptGraphs() {
  return Object.entries(SUBJECT_CONCEPT_GRAPHS)
    .filter(([, nodes]) => nodes.length > 0)
    .map(([subject, nodes]) => ({
      subject,
      nodes: nodes.length,
      entryConcepts: nodes.filter((node) => node.prerequisites.length === 0).map((node) => node.id),
    }));
}

export function inferConceptMetadata(input: LessonConceptInput): InferredConceptMetadata {
  const graph = getSubjectConceptGraph(input.subject);
  const haystack = `${input.unitTitle} ${input.lessonTitle}`.toLowerCase();
  const matched =
    graph.find((node) =>
      node.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
    ) ?? graph[0];

  const primaryConcept = matched?.id ?? `${input.subject.toLowerCase()}_foundations`;
  const prerequisites =
    input.orderInUnit <= 1 ? [...(matched?.prerequisites ?? [])] : [primaryConcept];
  const nextConcepts =
    matched?.nextConcepts && matched.nextConcepts.length > 0
      ? [...matched.nextConcepts]
      : input.orderInUnit >= 5
        ? []
        : [primaryConcept];

  return {
    primaryConcept,
    prerequisites,
    nextConcepts,
    difficulty: difficultyForOrder(input.orderInUnit),
  };
}

export function validateSubjectProgression(params: {
  subject: string;
  lessons: Array<{
    grade: number;
    orderInUnit: number | null;
    lessonTitle: string;
    unitTitle: string;
    primaryConcept?: string | null;
    prerequisites?: string[] | null;
    nextConcepts?: string[] | null;
    difficulty?: string | null;
  }>;
}) {
  const graph = getSubjectConceptGraph(params.subject);
  const nodeById = new Map(graph.map((node) => [node.id, node]));
  const violations: string[] = [];

  const unitBuckets = new Map<string, typeof params.lessons>();
  for (const lesson of params.lessons) {
    const key = `${lesson.grade}|${lesson.unitTitle}`;
    unitBuckets.set(key, [...(unitBuckets.get(key) ?? []), lesson]);
  }

  for (const [bucketKey, lessons] of unitBuckets.entries()) {
    const ordered = [...lessons].sort(
      (left, right) => (left.orderInUnit ?? 0) - (right.orderInUnit ?? 0)
    );
    const seenConcepts = new Set<string>();

    for (const lesson of ordered) {
      const inferred = inferConceptMetadata({
        subject: params.subject,
        grade: lesson.grade,
        unitTitle: lesson.unitTitle,
        lessonTitle: lesson.lessonTitle,
        orderInUnit: lesson.orderInUnit ?? 1,
      });
      const concept = lesson.primaryConcept ?? inferred.primaryConcept;
      const prerequisites = lesson.prerequisites ?? inferred.prerequisites;
      const difficulty = lesson.difficulty ?? inferred.difficulty;
      const node = nodeById.get(concept);

      if (node && lesson.grade < node.minGrade) {
        violations.push(`${bucketKey}:${lesson.lessonTitle}:advanced_before_basic:${concept}`);
      }

      if ((lesson.orderInUnit ?? 1) === 1 && difficulty !== "intro") {
        violations.push(`${bucketKey}:${lesson.lessonTitle}:difficulty_curve_intro`);
      }

      if ((lesson.orderInUnit ?? 1) >= 5 && difficulty !== "advanced") {
        violations.push(`${bucketKey}:${lesson.lessonTitle}:difficulty_curve_advanced`);
      }

      for (const prerequisite of prerequisites) {
        if (prerequisite === concept) continue;
        if (seenConcepts.has(prerequisite)) continue;
        if (nodeById.has(prerequisite)) continue;
        violations.push(`${bucketKey}:${lesson.lessonTitle}:broken_prerequisite:${prerequisite}`);
      }

      seenConcepts.add(concept);
    }
  }

  return violations;
}
