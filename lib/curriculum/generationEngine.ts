import { createHash } from "crypto";
import { CurriculumPayloadSchema } from "@/lib/schemas/curriculumPayload";
import {
  FULL_COVERAGE_CATALOG,
  listCoverageEntries,
  type CoverageCatalogEntry,
} from "@/lib/curriculum/fullCoverageCatalog";
import {
  CORE_SUBJECTS,
  getStorageSubject,
  normalizeSubject,
} from "@/lib/curriculum/subjectTaxonomy";
import { inferConceptMetadata } from "@/lib/curriculum/conceptGraph";
import { buildNr12GenerationPlan, isNr12Cell } from "@/lib/curriculum/nr12GradeDeserts";
import { buildNr13GenerationPlan, isNr13Cell, type Nr13Subject } from "@/lib/curriculum/nr13Grades58";

export const COVERAGE_ENGINE_VERSION = "coverage-engine-2026.1";
export const GENERATED_CURRICULUM_STATUS = "generated";
export const VALIDATED_CURRICULUM_STATUS = "validated";

type GenerationOptions = {
  grade?: number;
  subject?: string;
  limit?: number;
  allCore?: boolean;
  allK12?: boolean;
  term?: string;
};

export type GeneratedCoverageRecord = {
  contentId: string;
  grade: number;
  subject: string;
  canonicalSubject: string;
  contentType: "lesson";
  status: typeof GENERATED_CURRICULUM_STATUS;
  version: string;
  hash: string;
  unitId: string;
  orderInUnit: number;
  lessonType: "core";
  payload: Record<string, unknown>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildUnitTitles(entry: CoverageCatalogEntry) {
  return entry.unitThemes.slice(0, entry.unitsPerYear).map((theme, index) => ({
    unitIndex: index + 1,
    unitTitle: `${theme}`,
  }));
}

function buildLessonTitle(unitTitle: string, orderInUnit: number) {
  const sequenceLabels = [
    "Foundations",
    "Teacher Modeling",
    "Guided Application",
    "Independent Practice",
    "Assessment and Reflection",
    "Extension Task",
    "Project Application",
    "Review and Reinforcement",
  ];

  return `${unitTitle}: ${sequenceLabels[orderInUnit - 1] ?? `Lesson ${orderInUnit}`}`;
}

function buildStandardBody(params: {
  grade: number;
  subjectLabel: string;
  unitTitle: string;
  lessonTitle: string;
  objective: string;
  explanation: string;
  workedExample: string;
  guidedPractice: string;
  independentPractice: string;
  assessment: string;
  remediation: string;
  extension: string;
  guardianSupport: string;
}) {
  return [
    `## Objective`,
    params.objective,
    ``,
    `## Teacher Explanation`,
    params.explanation,
    ``,
    `## Worked Example`,
    params.workedExample,
    ``,
    `## Guided Practice`,
    params.guidedPractice,
    ``,
    `## Independent Practice`,
    params.independentPractice,
    ``,
    `## Assessment`,
    params.assessment,
    ``,
    `## Remediation`,
    params.remediation,
    ``,
    `## Extension`,
    params.extension,
    ``,
    `## Guardian Support`,
    params.guardianSupport,
    ``,
    `## Metadata`,
    `Grade ${params.grade} ${params.subjectLabel} unit "${params.unitTitle}" lesson "${params.lessonTitle}".`,
  ].join("\n");
}

function buildBlockBody(params: {
  objective: string;
  explanation: string;
  guidedPractice: string;
  assessment: string;
  guardianSupport: string;
}) {
  return [
    `## Day 1`,
    `${params.objective}\n${params.explanation}`,
    ``,
    `## Day 2`,
    `${params.guidedPractice}\n${params.assessment}`,
    ``,
    `## Home Support`,
    params.guardianSupport,
  ].join("\n");
}

function buildLessonPayload(entry: CoverageCatalogEntry, unitTitle: string, orderInUnit: number, term?: string) {
  const subjectLabel = entry.subject.replace(/_/g, " ");
  const lessonTitle = buildLessonTitle(unitTitle, orderInUnit);
  const progression = inferConceptMetadata({
    subject: entry.subject,
    grade: entry.grade,
    unitTitle,
    lessonTitle,
    orderInUnit,
  });
  const objective = `Students in Grade ${entry.grade} will explain and apply ${unitTitle.toLowerCase()} ideas using age-appropriate ${subjectLabel.toLowerCase()} tasks.`;
  const explanation = `The teacher introduces the core concept from ${unitTitle.toLowerCase()} using direct modeling, Liberia-relevant examples, key vocabulary, and a short understanding check before independent work.`;
  const workedExample = `Model one complete ${subjectLabel.toLowerCase()} example connected to ${unitTitle.toLowerCase()}, naming each step clearly and explaining why the answer is valid.`;
  const guidedPractice = `Guide learners through one shared task and one partner task that apply ${unitTitle.toLowerCase()} with teacher prompts, correction, and quick oral checks.`;
  const independentPractice = `Learners complete individual work that shows whether they can apply ${unitTitle.toLowerCase()} without copying the model, then explain one answer in writing or orally.`;
  const assessment = `Use a short exit task with two checks: one recall item and one application item aligned to the lesson objective.`;
  const remediation = `Re-teach the main step with simpler examples, sentence frames, and one scaffolded follow-up task for learners who need more support.`;
  const extension = `Ask confident learners to solve a slightly more complex version, justify their reasoning, or connect the idea to a real-world context.`;
  const guardianSupport = `Ask the learner to explain the main idea from today's lesson and complete one short home discussion or practice task using ordinary household materials when possible.`;

  const bodyStandard = buildStandardBody({
    grade: entry.grade,
    subjectLabel,
    unitTitle,
    lessonTitle,
    objective,
    explanation,
    workedExample,
    guidedPractice,
    independentPractice,
    assessment,
    remediation,
    extension,
    guardianSupport,
  });

  const bodyBlock = buildBlockBody({
    objective,
    explanation,
    guidedPractice,
    assessment,
    guardianSupport,
  });

  const basePayload = CurriculumPayloadSchema.parse({
    title: lessonTitle,
    grade: entry.grade,
    subject: getStorageSubject(entry.subject) ?? entry.subject,
    lessonFormat: "either",
    objectives: [objective],
    body: bodyStandard,
    body_standard: bodyStandard,
    body_block: bodyBlock,
    activities: [
      `Teacher modeling for ${unitTitle.toLowerCase()}`,
      `Guided pair practice on ${unitTitle.toLowerCase()}`,
      `Independent learner check aligned to the objective`,
    ],
    labs: [],
    moeAlignments: [],
    metadata: {
      topic: unitTitle,
      locale: "LR",
      generatedAt: "deterministic-coverage-engine",
      model: "template-engine",
    },
  });

  return {
    ...basePayload,
    canonicalSubject: entry.subject,
    unitTitle,
    primaryConcept: progression.primaryConcept,
    prerequisites: progression.prerequisites,
    nextConcepts: progression.nextConcepts,
    objective,
    explanation,
    workedExamples: [workedExample],
    guidedPractice: [guidedPractice],
    independentPractice: [independentPractice],
    assessment,
    remediation,
    extension,
    guardianSupport,
    generationStage: GENERATED_CURRICULUM_STATUS,
    difficulty: progression.difficulty,
    approvalWorkflow: [GENERATED_CURRICULUM_STATUS, VALIDATED_CURRICULUM_STATUS, "APPROVED", "published"],
    contentCompleteness: {
      objective: true,
      explanation: true,
      workedExamples: true,
      guidedPractice: true,
      independentPractice: true,
      assessment: true,
      remediation: true,
      extension: true,
      guardianSupport: true,
    },
    metadata: {
      ...basePayload.metadata,
      unitTitle,
      term: term ?? null,
      catalogBand: entry.band,
      totalLessonTarget: entry.totalLessonTarget,
    },
  };
}

function buildRecord(entry: CoverageCatalogEntry, unitTitle: string, unitIndex: number, orderInUnit: number, term?: string): GeneratedCoverageRecord {
  const unitSlug = slugify(unitTitle);
  const unitId = `${entry.subject.toLowerCase()}-g${entry.grade}-${unitIndex}-${unitSlug}`;
  const lessonSlug = slugify(buildLessonTitle(unitTitle, orderInUnit));
  const storageSubject = getStorageSubject(entry.subject) ?? entry.subject;
  const contentId = `${storageSubject.toLowerCase()}-g${entry.grade}-${unitIndex}-${lessonSlug}`;
  const payload = buildLessonPayload(entry, unitTitle, orderInUnit, term);
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);

  return {
    contentId,
    grade: entry.grade,
    subject: storageSubject,
    canonicalSubject: entry.subject,
    contentType: "lesson" as const,
    status: GENERATED_CURRICULUM_STATUS,
    version: COVERAGE_ENGINE_VERSION,
    hash,
    unitId,
    orderInUnit,
    lessonType: "core" as const,
    payload,
  };
}

function selectCatalogEntries(options: GenerationOptions) {
  const normalizedSubject = options.subject ? normalizeSubject(options.subject) : null;

  if (options.allCore) {
    const coreCodes = new Set(CORE_SUBJECTS.map((subject) => subject.code));
    return FULL_COVERAGE_CATALOG.filter((entry) => {
      if (!coreCodes.has(entry.subject)) return false;
      if (options.grade != null && entry.grade !== options.grade) return false;
      if (normalizedSubject && entry.subject !== normalizedSubject.code) return false;
      return true;
    });
  }

  if (options.allK12) {
    return listCoverageEntries({
      grade: options.grade,
      subject: normalizedSubject?.code,
    });
  }

  if (options.grade != null || normalizedSubject) {
    return listCoverageEntries({
      grade: options.grade,
      subject: normalizedSubject?.code,
    });
  }

  return [];
}

export function buildCoverageGenerationPlan(options: GenerationOptions) {
  const normalizedSubject = options.subject ? normalizeSubject(options.subject) : null;
  if (options.grade != null && normalizedSubject?.code === "LITERACY" && isNr13Cell(options.grade, "ENGLISH")) {
    let records = buildNr13GenerationPlan(options.grade, "ENGLISH");
    if (options.limit != null && options.limit > 0) records = records.slice(0, options.limit);
    return records;
  }

  const entries = selectCatalogEntries(options);
  let records: GeneratedCoverageRecord[] = entries.flatMap((entry): GeneratedCoverageRecord[] => {
    const entrySubject = String(entry.subject);
    const nr13Subject = entrySubject === "LITERACY" ? "ENGLISH" : (entrySubject as Nr13Subject);
    if (isNr12Cell(entry.grade, entry.subject)) return buildNr12GenerationPlan(entry.grade, entry.subject);
    if (isNr13Cell(entry.grade, nr13Subject)) return buildNr13GenerationPlan(entry.grade, nr13Subject);
    return buildUnitTitles(entry).flatMap(({ unitIndex, unitTitle }) =>
      Array.from({ length: entry.lessonsPerUnit }, (_, lessonIndex) =>
        buildRecord(entry, unitTitle, unitIndex, lessonIndex + 1, options.term)
      )
    );
  });

  if (options.limit != null && options.limit > 0) {
    records = records.slice(0, options.limit);
  }

  return records;
}

export function summarizeCoverageGenerationPlan(options: GenerationOptions) {
  const records = buildCoverageGenerationPlan(options);
  const bySubject = new Map<string, number>();
  const byGrade = new Map<number, number>();
  const unitIds = new Set<string>();

  for (const record of records) {
    bySubject.set(record.canonicalSubject, (bySubject.get(record.canonicalSubject) ?? 0) + 1);
    byGrade.set(record.grade, (byGrade.get(record.grade) ?? 0) + 1);
    unitIds.add(record.unitId);
  }

  return {
    selectedLessons: records.length,
    selectedUnits: unitIds.size,
    bySubject: Object.fromEntries([...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byGrade: Object.fromEntries([...byGrade.entries()].sort((a, b) => a[0] - b[0])),
  };
}
