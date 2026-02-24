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
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Reads the env var at call time — safe to use in tests where env vars
 * are mutated between assertions without needing module resets.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return process.env[`NEXT_PUBLIC_${flag}`] === "true";
}
