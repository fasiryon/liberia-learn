import { GRADE4_MATH_ONTOLOGY_RELEASE, validateOntologyRelease, type CurriculumOntologyRelease } from "./governedGrade4Math";

// Add reviewed releases here as they are published. Runtime code never infers a
// binding from a lesson title, grade, or generated content.
const releases: readonly CurriculumOntologyRelease[] = [GRADE4_MATH_ONTOLOGY_RELEASE];

export function publishedRelease(id: string): CurriculumOntologyRelease | null {
  const release = releases.find((entry) => entry.id === id);
  if (!release) return null;
  validateOntologyRelease(release);
  return release;
}

export function publishedReleaseForLearner(grade: number, subject?: string): CurriculumOntologyRelease | null {
  const release = releases.find((entry) => entry.grade === grade && (!subject || entry.subject === subject));
  if (!release) return null;
  validateOntologyRelease(release);
  return release;
}
