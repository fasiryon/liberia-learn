/**
 * NR-3: naming-convention exclusion for the synthetic load-test pool
 * (scripts/seed-load-test-pool.ts). String-match only, no schema flag yet —
 * see docs/roadmaps/CONSOLIDATED_BACKLOG.md for the proposed isSynthetic
 * column escalation. Apply these to any query whose result is displayed on
 * an MOE/platform/admin-facing dashboard, list, or leaderboard.
 */

export const LOAD_TEST_SCHOOL_CODE_PREFIX = "lt-school-"
export const LOAD_TEST_EMAIL_DOMAIN = "@loadtest.liberialearn.internal"

// SQL NULL semantics: `code: { not: { startsWith } }` alone silently drops
// rows where code IS NULL too (NOT NULL evaluates to NULL, which a WHERE
// clause treats as "exclude"). Verified live 2026-07-31: this dropped 6 real
// schools with no code assigned. Explicitly include null-code rows as real.
export const excludeSyntheticSchoolWhere = {
  OR: [
    { code: null },
    { code: { not: { startsWith: LOAD_TEST_SCHOOL_CODE_PREFIX } } },
  ],
}

export const excludeSyntheticUserWhere = {
  email: { not: { contains: LOAD_TEST_EMAIL_DOMAIN } },
} as const

export function isSyntheticSchoolCode(code: string | null | undefined): boolean {
  return !!code && code.startsWith(LOAD_TEST_SCHOOL_CODE_PREFIX)
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.includes(LOAD_TEST_EMAIL_DOMAIN)
}
