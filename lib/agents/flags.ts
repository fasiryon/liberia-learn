/**
 * Agent kill switches. Follows the serverFlags convention: a flag is ON only
 * when its env var trims to exactly "true" (tolerates trailing CRLF/whitespace
 * that `vercel env pull` and dashboard copy-paste append). Default OFF.
 */
export function isAgentEnabled(featureFlag: string): boolean {
  return process.env[featureFlag]?.trim() === "true";
}
