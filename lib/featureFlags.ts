/**
 * Client-safe feature flags resolved from NEXT_PUBLIC_ env vars.
 *
 * Values are inlined at build time by Next.js for client bundles.
 * In server components and API routes the live process.env is used.
 *
 * To enable a flag, add to .env.local:
 *   NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING=true
 *   NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE=true
 *
 * Operators can disable at deploy time without a code change.
 * See docs/ops/FEATURE_FLAGS.md for the full flag catalogue.
 */

export const FEATURE_FLAGS = {
  ENABLE_GUIDED_ONBOARDING: process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING === "true",
  ENABLE_ACCESSIBILITY_MODE: process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE === "true",
  /** Training Center — 8 micro-modules, progress tracking, badges, admin adoption view. */
  ENABLE_TRAINING_CENTER: process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER === "true",
  /**
   * Mastery Engine (Block 7A) — strand taxonomy, question tagging, per-student mastery
   * profiles, hybrid scoring by grade band, and mastery telemetry events.
   * Does NOT include adaptive baseline (Block 7B).
   */
  ENABLE_MASTERY_ENGINE: process.env.NEXT_PUBLIC_ENABLE_MASTERY_ENGINE === "true",
  /**
   * Adaptive Baseline (Block 7B) — per-student EMA-based ability estimates per strand.
   * Requires ENABLE_MASTERY_ENGINE to be meaningful, but is independently gated.
   * When off: GET /api/student/baseline returns { ability: 0, disabled: true }.
   *           POST /api/student/baseline/evidence is a no-op (200, { disabled: true }).
   */
  ENABLE_ADAPTIVE_BASELINE: process.env.NEXT_PUBLIC_ENABLE_ADAPTIVE_BASELINE === "true",
  /**
   * Monthly Hybrid Reports (Block 8) — monthly performance report generation,
   * storage, and retrieval at school/national scope.
   * When off: POST /api/admin/reports/monthly/generate returns { disabled: true }.
   *           Existing stored reports remain readable.
   */
  ENABLE_MONTHLY_REPORTS: process.env.NEXT_PUBLIC_ENABLE_MONTHLY_REPORTS === "true",
  /**
   * Report PDF Export (Block 8 stub) — PDF rendering for monthly reports.
   * Requires a PDF generation library (not bundled). When off (default): PDF format
   * requests return 501 Not Implemented with instructions to enable once the PDF
   * library is installed and the flag is set.
   */
  ENABLE_REPORT_PDF_EXPORT: process.env.NEXT_PUBLIC_ENABLE_REPORT_PDF_EXPORT === "true",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Reads the env var at call time — safe to use in tests where env vars
 * are mutated between assertions without needing module resets.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return process.env[`NEXT_PUBLIC_${flag}`] === "true";
}
