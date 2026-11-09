/**
 * Agent kill switches. Follows the serverFlags convention: a flag is ON only
 * when its env var trims to exactly "true" (tolerates trailing CRLF/whitespace
 * that `vercel env pull` and dashboard copy-paste append). Default OFF.
 */
export function isAgentEnabled(featureFlag: string): boolean {
  return getAgentEmergencyStop(featureFlag) === null && process.env[featureFlag]?.trim() === "true";
}

export type AgentActivationSource = "global_emergency_disable" | "env_disabled" | "db_override" | "env_flag" | "default_disabled" | "env_fallback";
export type AgentActivationState = { enabled: boolean; source: AgentActivationSource };

/** Absolute stops cannot be restored by a database override or dispatcher. */
export function getAgentEmergencyStop(featureFlag: string): "global_emergency_disable" | "env_disabled" | null {
  if (process.env.AGENT_PLATFORM_EMERGENCY_DISABLED?.trim() === "true") return "global_emergency_disable";
  if (process.env[featureFlag]?.trim() === "false") return "env_disabled";
  return null;
}

export function getAgentActivationState(featureFlag: string, override: boolean | null, envEnabled = isAgentEnabled(featureFlag)): AgentActivationState {
  const stop = getAgentEmergencyStop(featureFlag);
  if (stop) return { enabled: false, source: stop };
  if (override !== null) return { enabled: override, source: "db_override" };
  return { enabled: envEnabled, source: envEnabled ? "env_flag" : "default_disabled" };
}
