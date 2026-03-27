/**
 * Client-safe feature flags resolved from NEXT_PUBLIC_ env vars.
 *
 * Values are inlined at build time by Next.js for client bundles.
 * In server components and API routes the live process.env is used.
 */

export const FEATURE_FLAGS = {
  ENABLE_GUIDED_ONBOARDING:
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING === "true",
  ENABLE_ACCESSIBILITY_MODE:
    process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE === "true",
  ENABLE_GUARDIAN_PORTAL:
    process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL === "true",
  ENABLE_ENROLLMENT_INVITES:
    process.env.NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES === "true",
  ENABLE_ACCOUNT_RECOVERY:
    process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY === "true",
  ENABLE_RAG_TUTOR: process.env.NEXT_PUBLIC_ENABLE_RAG_TUTOR === "true",
  ENABLE_TRAINING_CENTER:
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER === "true",
  ENABLE_MASTERY_ENGINE:
    process.env.NEXT_PUBLIC_ENABLE_MASTERY_ENGINE === "true",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return process.env[`NEXT_PUBLIC_${flag}`] === "true";
}
