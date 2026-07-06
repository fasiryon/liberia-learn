/**
 * Pure USD rounding helper, kept separate from DB-side-effect modules so it can
 * be imported without pulling in prisma (and so it survives module mocking).
 *
 * Rounds to 6 decimal places — safely beyond the sprint's required 4dp accuracy.
 */
export function roundUSD(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
