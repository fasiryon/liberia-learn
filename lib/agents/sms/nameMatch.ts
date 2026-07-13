/**
 * Fuzzy name matching for the Student-ID + name identity challenge
 * (docs/agents/GUARDIAN_IDENTITY_VERIFICATION.md). Deliberately a general
 * Unicode-normalization + edit-distance approach, not a hardcoded table of
 * "common Liberian name variants" - no verified source for such a table
 * exists in this repo, and a general algorithm degrades gracefully instead
 * of silently failing on a name it wasn't specifically trained on.
 *
 * Design: tolerant of diacritics, case, punctuation, and a single-token
 * partial name ("Pewu" matches "Pewu Gongloe" - the Student ID has already
 * narrowed the search to one specific student, so the name is a secondary
 * confirmation factor, not the primary identifier). Short tokens (<=3
 * letters) require an exact match - fuzzy-matching short strings produces
 * too many false positives to be a meaningful check.
 */

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeToken(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z'-]/g, "");
}

function tokenize(fullName: string): string[] {
  return fullName
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 0);
}

/** Iterative Levenshtein distance. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function tokensFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter <= 3) return false; // exact-only for short tokens
  const longer = Math.max(a.length, b.length);
  const maxDistance = longer >= 7 ? 2 : 1;
  return levenshtein(a, b) <= maxDistance;
}

/**
 * True if every token in `inputName` fuzzy-matches some token in
 * `studentFullName`. A single matching token is sufficient (partial names
 * allowed), but every token the caller *did* supply must match - a name
 * with an extra, non-matching token fails rather than partially passing.
 */
export function matchesGuardianChallengeName(inputName: string, studentFullName: string): boolean {
  const inputTokens = tokenize(inputName);
  if (inputTokens.length === 0) return false;
  const studentTokens = tokenize(studentFullName);
  if (studentTokens.length === 0) return false;

  return inputTokens.every((it) => studentTokens.some((st) => tokensFuzzyMatch(it, st)));
}
