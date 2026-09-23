import inventory from "@/curriculum/sources/repository-source-inventory.json";
import grade16 from "@/curriculum/sources/intermediate/GRADE-1-6.json";
import grade79 from "@/curriculum/sources/intermediate/GRADE-7-9.json";
import grade1012 from "@/curriculum/sources/intermediate/Grade-10-12.json";

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

export function repositoryExtractionSummary() {
  const manifests = [...grade16.manifests, ...grade79.manifests, ...grade1012.manifests];
  return {
    pdfsProcessed: manifests.length,
    pagesDecoded: manifests.reduce((total, manifest) => total + manifest.extraction.decodedPageCount, 0),
    pagesProcessed: manifests.reduce((total, manifest) => total + manifest.extraction.pageCount, 0),
    ambiguousPages: manifests.reduce((total, manifest) => total + manifest.extraction.reviewQueue.length, 0),
    standardsCandidates: manifests.reduce((total, manifest) => total + manifest.extraction.standards.length, 0),
    objectiveCandidates: manifests.reduce((total, manifest) => total + manifest.extraction.objectives.length, 0),
    sequencingCandidates: manifests.reduce((total, manifest) => total + manifest.extraction.sequencing.length, 0),
  } as const;
}
