import inventory from "@/curriculum/sources/repository-source-inventory.json";

export type RepositorySource = (typeof inventory.sources)[number];

const CANONICAL_SUBJECTS: Record<string, readonly string[]> = {
  ENGLISH: ["LITERACY"],
  ENGLISH_GRAMMAR: ["LITERACY"],
  GENERAL_SCIENCE: ["SCIENCE"],
  BIOLOGY: ["SCIENCE"],
  CHEMISTRY: ["SCIENCE"],
  PHYSICS: ["SCIENCE"],
  MATH: ["MATH"],
  SOCIAL_STUDIES: ["SOCIAL_STUDIES"],
  GEOGRAPHY: ["SOCIAL_STUDIES"],
  HISTORY: ["SOCIAL_STUDIES"],
};

export function repositorySources(): readonly RepositorySource[] {
  return inventory.sources;
}

export function sourceBackedCells(scope: { grades: readonly number[]; subjects: readonly string[] }) {
  return scope.grades.flatMap((grade) => scope.subjects
    .filter((subject) => repositorySources().some((source) =>
      source.contentPresentInRepository && source.gradeMin <= grade && source.gradeMax >= grade &&
      source.subjects.some((sourceSubject) => CANONICAL_SUBJECTS[sourceSubject]?.includes(subject)),
    ))
    .map((subject) => `${grade}:${subject}`));
}

export function documentedSourceCells(scope: { grades: readonly number[]; subjects: readonly string[] }) {
  return scope.grades.flatMap((grade) => scope.subjects
    .filter((subject) => repositorySources().some((source) =>
      source.gradeMin <= grade && source.gradeMax >= grade &&
      source.subjects.some((sourceSubject) => CANONICAL_SUBJECTS[sourceSubject]?.includes(subject)),
    ))
    .map((subject) => `${grade}:${subject}`));
}
