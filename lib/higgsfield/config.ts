import { config as sdkConfig } from "@higgsfield/client/v2";

/** Endpoint for the Higgsfield Soul text-to-video model. */
export const HIGGSFIELD_VIDEO_ENDPOINT = "higgsfield-ai/soul/standard";

/** Returns true when HIGGSFIELD_CREDENTIALS is set and well-formed (KEY_ID:KEY_SECRET). */
export function isHiggsfieldConfigured(): boolean {
  const creds = process.env.HIGGSFIELD_CREDENTIALS?.trim();
  if (!creds) return false;
  const parts = creds.split(":");
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Configures the global @higgsfield/client/v2 singleton from HIGGSFIELD_CREDENTIALS.
 * Call once before each generation request (idempotent — safe to call repeatedly).
 * Throws if credentials are missing or malformed.
 */
export function configureHiggsfieldClient(): void {
  const creds = process.env.HIGGSFIELD_CREDENTIALS?.trim();
  if (!creds) throw new Error("HIGGSFIELD_CREDENTIALS not configured");
  sdkConfig({ credentials: creds });
}
