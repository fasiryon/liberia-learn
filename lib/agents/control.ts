import { prisma } from "@/lib/db";
import { isAgentEnabled } from "@/lib/agents/flags";
import { logger } from "@/lib/logger";

/**
 * Runtime kill-switch resolution. An AgentControl row can override the env
 * feature flag from the admin dashboard: enabledOverride true/false wins; null
 * (or no row) defers to the env flag. Fails safe to the env flag on DB error.
 */
export async function resolveAgentEnabled(
  agentName: string,
  featureFlag: string
): Promise<boolean> {
  try {
    const control = await prisma.agentControl.findUnique({ where: { agentName } });
    if (control && control.enabledOverride !== null && control.enabledOverride !== undefined) {
      return control.enabledOverride;
    }
  } catch (e) {
    logger.warn("[agent.control] override lookup failed, using env flag", {
      agentName,
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
  }
  return isAgentEnabled(featureFlag);
}

/** Set (or clear, with null) an agent's kill-switch override. */
export async function setAgentControl(
  agentName: string,
  enabledOverride: boolean | null,
  updatedBy: string
): Promise<void> {
  await prisma.agentControl.upsert({
    where: { agentName },
    create: { agentName, enabledOverride, updatedBy },
    update: { enabledOverride, updatedBy },
  });
}

/** All overrides keyed by agentName (for the admin dashboard). */
export async function getAllControls(): Promise<Record<string, boolean | null>> {
  const rows = await prisma.agentControl.findMany();
  const out: Record<string, boolean | null> = {};
  for (const r of rows) out[r.agentName] = r.enabledOverride ?? null;
  return out;
}
