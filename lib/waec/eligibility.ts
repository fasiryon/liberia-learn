/**
 * WAEC Prep is Grade 9+ in the Liberian system (WASSCE preparation begins around
 * Senior Secondary). Lower grades never see the WAEC surface (link hidden, route
 * redirects) — no "not eligible" message is shown.
 */
export const WAEC_MIN_GRADE = 9;

export function isWaecEligible(grade: number | null | undefined): boolean {
  return (grade ?? 0) >= WAEC_MIN_GRADE;
}
