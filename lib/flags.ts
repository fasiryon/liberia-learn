/**
 * lib/flags.ts
 *
 * Async feature flags backed by Vercel Edge Config.
 * Edge Config updates propagate globally in < 1s — no redeploy required.
 *
 * Graceful fallback: when Edge Config is unavailable (missing env var,
 * network error) the `defaultValue` is returned, so the platform never
 * fails hard on a missing flag.
 *
 * Key convention: "feature:<name>"  e.g. "feature:ai_tutor"
 *
 * Add EDGE_CONFIG=<connection-string> to Vercel environment variables
 * (Vercel dashboard → Storage → Edge Config → your config item).
 */

import { get } from "@vercel/edge-config";

export async function getFlag(key: string, defaultValue = true): Promise<boolean> {
  try {
    const val = await get<boolean>(key);
    return val ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

// ── Named async flag helpers (Edge Config keys) ───────────────────────────────

/**
 * AI Tutor Edge Config kill-switch. Default ON (env var AI_TUTOR_ENABLED already
 * gates the feature; this flag lets ops disable instantly without redeploy).
 * Edge key: feature:ai_tutor
 */
export async function isAiTutorFlagEnabled(): Promise<boolean> {
  return getFlag("feature:ai_tutor", true);
}

/** Live SMS delivery. Default ON. Edge key: feature:sms */
export async function isSmsFlagEnabled(): Promise<boolean> {
  return getFlag("feature:sms", true);
}

/** National league table. Default ON. Edge key: feature:league_table */
export async function isLeagueTableFlagEnabled(): Promise<boolean> {
  return getFlag("feature:league_table", true);
}

/** Verifiable student portfolio. Default ON. Edge key: feature:portfolio */
export async function isPortfolioFlagEnabled(): Promise<boolean> {
  return getFlag("feature:portfolio", true);
}

/** Google SSO for teachers. Default OFF. Edge key: feature:google_sso */
export async function isGoogleSsoFlagEnabled(): Promise<boolean> {
  return getFlag("feature:google_sso", false);
}
