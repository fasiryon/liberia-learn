import { toCanonicalJson, type CanonicalJson } from "@/lib/curriculum/provenance/hash";

export const CURRICULUM_SNAPSHOT_SCHEMA_VERSION = 1;

export type CurriculumProjectionInput = {
  title?: string | null;
  grade: number;
  subject: string;
  contentType: string;
  payload: unknown;
  moeAlignments?: unknown;
  waecSyllabusTopics?: string[] | null;
  deliveryProfile?: unknown;
  unitId?: string | null;
  orderInUnit?: number | null;
  lessonType?: string | null;
  learningObjectives?: unknown;
  heroImageUrl?: string | null;
  heroImageMeta?: unknown;
  inlineIllustrations?: unknown;
};

export type CurriculumContentSnapshotV1 = {
  identity: {
    title: string;
    description: string | null;
    grade: number;
    subject: string;
    contentType: string;
  };
  placement: {
    unitId: string | null;
    orderInUnit: number | null;
    lessonType: string | null;
  };
  delivery: {
    lessonFormat: string | null;
    estimatedMinutes: number | null;
    deliveryProfile: CanonicalJson;
    body: string | null;
    bodyStandard: string | null;
    bodyBlock: string | null;
    legacyContent: string | null;
    lessonContent: string | null;
  };
  instruction: {
    objectives: string[];
    authoringObjectives: CanonicalJson;
    activities: CanonicalJson[];
    teacherExplanation: CanonicalJson;
    workedExamples: CanonicalJson;
    guidedPractice: CanonicalJson;
    independentPractice: CanonicalJson;
    realWorldApplication: CanonicalJson;
    teacherNotes: CanonicalJson;
    remediation: CanonicalJson;
    extension: CanonicalJson;
    guardianSupport: CanonicalJson;
    materialsNotes: CanonicalJson;
    takeawaySummary: string | null;
  };
  assessment: {
    assessment: CanonicalJson;
    assessmentQuestions: CanonicalJson[];
    quiz: CanonicalJson;
    problemSets: CanonicalJson[];
    rubric: CanonicalJson;
    masteryChecks: CanonicalJson;
  };
  resources: {
    labs: CanonicalJson[];
    textbook: CanonicalJson;
    resources: CanonicalJson;
    slideDeckSpecs: CanonicalJson[];
    audioScriptSpecs: CanonicalJson[];
    heroImage: { url: string; metadata: CanonicalJson } | null;
    inlineIllustrations: CanonicalJson[];
  };
  curriculumPlan: {
    term: CanonicalJson;
    unitTitle: string | null;
    termPlan: CanonicalJson;
    weeks: CanonicalJson[];
    units: CanonicalJson[];
    lessons: CanonicalJson[];
  };
  standards: {
    moeAlignments: CanonicalJson;
    waecSyllabusTopics: string[];
  };
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] {
  return array(value).filter((entry): entry is string => typeof entry === "string");
}

function json(value: unknown): CanonicalJson {
  return value === undefined ? null : toCanonicalJson(value);
}

function jsonArray(value: unknown): CanonicalJson[] {
  return array(value).map(toCanonicalJson);
}

export function buildCurriculumContentSnapshotV1(
  row: CurriculumProjectionInput,
): CurriculumContentSnapshotV1 {
  const payload = object(row.payload);
  const metadata = object(payload.metadata);
  const scalarObjectives = array(row.learningObjectives);
  const payloadObjectives = strings(payload.objectives);
  const objectives =
    payloadObjectives.length > 0
      ? payloadObjectives
      : scalarObjectives.filter((entry): entry is string => typeof entry === "string");
  const heroImageUrl = row.heroImageUrl ?? text(payload.heroImageUrl);
  const waecSyllabusTopics = Array.from(
    new Set((row.waecSyllabusTopics ?? []).filter((entry) => typeof entry === "string")),
  ).sort();

  return {
    identity: {
      title: text(payload.title) ?? row.title ?? "",
      description: text(payload.description),
      grade: row.grade,
      subject: row.subject,
      contentType: row.contentType,
    },
    placement: {
      unitId: row.unitId ?? null,
      orderInUnit: row.orderInUnit ?? null,
      lessonType: row.lessonType ?? null,
    },
    delivery: {
      lessonFormat: text(payload.lessonFormat) ?? text(payload.format),
      estimatedMinutes: number(payload.estimatedMinutes),
      deliveryProfile: json(row.deliveryProfile ?? payload.deliveryProfile),
      body: text(payload.body),
      bodyStandard: text(payload.body_standard),
      bodyBlock: text(payload.body_block),
      legacyContent: text(payload.content),
      lessonContent: text(payload.lessonContent),
    },
    instruction: {
      objectives,
      authoringObjectives: json(row.learningObjectives),
      activities: jsonArray(payload.activities),
      teacherExplanation: json(payload.teacherExplanation),
      workedExamples: json(payload.workedExamples),
      guidedPractice: json(payload.guidedPractice),
      independentPractice: json(payload.independentPractice),
      realWorldApplication: json(payload.realWorldApplication),
      teacherNotes: json(payload.teacherNotes),
      remediation: json(payload.remediation),
      extension: json(payload.extension),
      guardianSupport: json(payload.guardianSupport),
      materialsNotes: json(payload.materialsNotes ?? payload.materials),
      takeawaySummary: text(payload.takeawaySummary) ?? text(payload.summary),
    },
    assessment: {
      assessment: json(payload.assessment),
      assessmentQuestions: jsonArray(payload.assessmentQuestions),
      quiz: json(payload.quiz),
      problemSets: jsonArray(payload.problemSets),
      rubric: json(payload.rubric),
      masteryChecks: json(payload.masteryChecks),
    },
    resources: {
      labs: jsonArray(payload.labs ?? payload.lab),
      textbook: json(payload.textbook ?? payload.textbookChapter),
      resources: json(payload.resources),
      slideDeckSpecs: jsonArray(payload.slideDeckSpecs ?? payload.slides),
      audioScriptSpecs: jsonArray(payload.audioScriptSpecs ?? payload.audioScripts),
      heroImage: heroImageUrl
        ? { url: heroImageUrl, metadata: json(row.heroImageMeta ?? payload.heroImageMeta) }
        : null,
      inlineIllustrations: jsonArray(row.inlineIllustrations ?? payload.inlineIllustrations),
    },
    curriculumPlan: {
      term: json(payload.term),
      unitTitle: text(payload.unitTitle),
      termPlan: json(payload.termPlan),
      weeks: jsonArray(payload.weeks),
      units: jsonArray(payload.units),
      lessons: jsonArray(payload.lessons),
    },
    standards: {
      moeAlignments: json(row.moeAlignments),
      waecSyllabusTopics,
    },
  };
}

export function validateCurriculumContentSnapshotV1(
  snapshot: CurriculumContentSnapshotV1,
): void {
  if (!Number.isInteger(snapshot.identity.grade) || snapshot.identity.grade < 1 || snapshot.identity.grade > 12) {
    throw new Error("Curriculum snapshot grade must be an integer from 1 to 12");
  }
  for (const field of ["title", "subject", "contentType"] as const) {
    if (!snapshot.identity[field].trim()) {
      throw new Error(`Curriculum snapshot identity.${field} is required`);
    }
  }
  const hasInstructionalBody = [
    snapshot.delivery.body,
    snapshot.delivery.bodyStandard,
    snapshot.delivery.bodyBlock,
    snapshot.delivery.legacyContent,
    snapshot.delivery.lessonContent,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
  const hasStructuredInstruction =
    snapshot.instruction.activities.length > 0 ||
    snapshot.curriculumPlan.lessons.length > 0 ||
    snapshot.resources.labs.length > 0 ||
    snapshot.resources.textbook !== null;
  if (!hasInstructionalBody && !hasStructuredInstruction) {
    throw new Error("Curriculum snapshot contains no learner-visible instructional content");
  }
}

export const SNAPSHOT_V1_INCLUDED_FIELDS = Object.freeze([
  "identity",
  "placement",
  "delivery",
  "instruction",
  "assessment",
  "resources",
  "curriculumPlan",
  "standards",
]);

export const SNAPSHOT_V1_EXCLUDED_FIELDS = Object.freeze([
  "status",
  "approvalStatus",
  "approvedByUserId",
  "approvedAt",
  "rejectedByUserId",
  "rejectedAt",
  "riskScore",
  "riskReasons",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "editedAt",
  "generationJobId",
  "regenerationRunId",
  "model",
  "provider",
  "promptKey",
  "promptVersion",
  "promptHash",
  "schoolId",
  "visibility",
  "thumbnailStatus",
  "thumbnailError",
  "imageGenerationCost",
]);
