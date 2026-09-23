import { publishedReleases } from "./publishedReleases";
import type { CurriculumOntologyRelease } from "./governedGrade4Math";

/**
 * Legacy callers that omit a release are allowed only while the registry has
 * exactly one release. Once multiple releases are registered, omission fails
 * closed instead of silently selecting Grade 4 or any other grade.
 */
export function compatibilityRelease(): CurriculumOntologyRelease {
  const releases = publishedReleases();
  if (releases.length !== 1) throw new Error("ontology_release_required");
  return releases[0];
}
