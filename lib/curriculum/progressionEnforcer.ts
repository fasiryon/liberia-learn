import { inferConceptMetadata, validateSubjectProgression } from "@/lib/curriculum/conceptGraph";

type CurriculumRow = {
  id: string;
  grade: number;
  subject: string;
  status: string;
  unitId: string | null;
  orderInUnit: number | null;
  payload: unknown;
};

type LessonPayload = Record<string, unknown>;

function asPayload(value: unknown): LessonPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as LessonPayload;
}

function getUnitTitle(payload: LessonPayload) {
  if (typeof payload.unitTitle === "string" && payload.unitTitle.trim()) {
    return payload.unitTitle.trim();
  }

  if (
    payload.metadata &&
    typeof payload.metadata === "object" &&
    !Array.isArray(payload.metadata) &&
    typeof (payload.metadata as Record<string, unknown>).unitTitle === "string"
  ) {
    return ((payload.metadata as Record<string, unknown>).unitTitle as string).trim();
  }

  return "Untitled Unit";
}

function getLessonTitle(payload: LessonPayload, fallback: string) {
  if (typeof payload.title === "string" && payload.title.trim()) {
    return payload.title.trim();
  }
  return fallback;
}

function inferOrderFromTitle(title: string, fallback: number | null) {
  const normalized = title.toLowerCase();
  if (normalized.includes("foundations")) return 1;
  if (normalized.includes("teacher modeling")) return 2;
  if (normalized.includes("guided application")) return 3;
  if (normalized.includes("independent practice")) return 4;
  if (normalized.includes("assessment and reflection")) return 5;
  return fallback ?? 1;
}

export function buildProgressionPatch(row: CurriculumRow) {
  const payload = asPayload(row.payload);
  const unitTitle = getUnitTitle(payload);
  const lessonTitle = getLessonTitle(payload, row.id);
  const orderInUnit = inferOrderFromTitle(lessonTitle, row.orderInUnit);
  const inferred = inferConceptMetadata({
    subject: row.subject,
    grade: row.grade,
    unitTitle,
    lessonTitle,
    orderInUnit,
  });

  const nextPayload: LessonPayload = {
    ...payload,
    unitTitle,
    primaryConcept: inferred.primaryConcept,
    prerequisites: inferred.prerequisites,
    nextConcepts: inferred.nextConcepts,
    difficulty: inferred.difficulty,
    difficultyLevel:
      typeof payload.difficultyLevel === "string" ? payload.difficultyLevel : inferred.difficulty,
  };

  return {
    orderInUnit,
    payload: nextPayload,
    changes: {
      primaryConcept:
        payload.primaryConcept !== inferred.primaryConcept,
      prerequisites:
        JSON.stringify(payload.prerequisites ?? null) !== JSON.stringify(inferred.prerequisites),
      nextConcepts:
        JSON.stringify(payload.nextConcepts ?? null) !== JSON.stringify(inferred.nextConcepts),
      difficulty:
        payload.difficulty !== inferred.difficulty,
      orderInUnit:
        row.orderInUnit !== orderInUnit,
    },
  };
}

export function validateProgressionRows(rows: CurriculumRow[]) {
  const bySubject = new Map<string, CurriculumRow[]>();
  for (const row of rows) {
    bySubject.set(row.subject, [...(bySubject.get(row.subject) ?? []), row]);
  }

  return Object.fromEntries(
    [...bySubject.entries()].map(([subject, subjectRows]) => [
      subject,
      validateSubjectProgression({
        subject,
        lessons: subjectRows.map((row) => {
          const payload = asPayload(row.payload);
          return {
            grade: row.grade,
            orderInUnit: row.orderInUnit,
            lessonTitle: getLessonTitle(payload, row.id),
            unitTitle: getUnitTitle(payload),
            primaryConcept:
              typeof payload.primaryConcept === "string" ? payload.primaryConcept : null,
            prerequisites: Array.isArray(payload.prerequisites)
              ? payload.prerequisites.filter((value): value is string => typeof value === "string")
              : null,
            nextConcepts: Array.isArray(payload.nextConcepts)
              ? payload.nextConcepts.filter((value): value is string => typeof value === "string")
              : null,
            difficulty:
              typeof payload.difficulty === "string" ? payload.difficulty : null,
          };
        }),
      }),
    ])
  );
}
