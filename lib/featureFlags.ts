/**
 * Client-safe feature flags resolved from NEXT_PUBLIC_ env vars.
 *
 * Values are inlined at build time by Next.js for client bundles.
 * In server components and API routes the live process.env is used.
 */

// NOTE: each property below must keep a literal `process.env.NEXT_PUBLIC_X`
// expression (not a dynamic-key helper call) - Next.js only inlines
// NEXT_PUBLIC_* vars into the client bundle when it can statically see the
// exact `process.env.NEXT_PUBLIC_X` text at build time. `.trim()` chained
// onto the literal is safe and still gets inlined; a shared function taking
// the name as a runtime string would not (see lib/serverFlags.ts's
// isFlagEnabled() for the server-only equivalent, which CAN centralize).
export const FEATURE_FLAGS = {
  ENABLE_GUIDED_ONBOARDING:
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING?.trim() === "true",
  ENABLE_ACCESSIBILITY_MODE:
    process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE?.trim() === "true",
  ENABLE_GUARDIAN_PORTAL:
    process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL?.trim() !== "false",
  ENABLE_ENROLLMENT_INVITES:
    process.env.NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES?.trim() === "true",
  ENABLE_ACCOUNT_RECOVERY:
    process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY?.trim() === "true",
  ENABLE_RAG_TUTOR: process.env.NEXT_PUBLIC_ENABLE_RAG_TUTOR?.trim() === "true",
  ENABLE_TRAINING_CENTER:
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER?.trim() === "true",
  ENABLE_MASTERY_ENGINE:
    process.env.NEXT_PUBLIC_ENABLE_MASTERY_ENGINE?.trim() === "true",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return process.env[`NEXT_PUBLIC_${flag}`]?.trim() === "true";
}
