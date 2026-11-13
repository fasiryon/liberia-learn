import { prisma } from "@/lib/db";
import { isAgentEnabled, getAgentEmergencyStop, getAgentActivationState, type AgentActivationState } from "@/lib/agents/flags";
import { logger } from "@/lib/logger";

/**
 * Absolute environment stops win. Otherwise an AgentControl override wins;
 * null defers to the default-off environment flag. Source is exposed to callers.
 */
export async function resolveAgentEnabled(
  agentName: string,
  featureFlag: string
): Promise<boolean> {
  return (await resolveAgentActivationState(agentName, featureFlag)).enabled;
}

export async function resolveAgentActivationState(agentName: string, featureFlag: string): Promise<AgentActivationState> {
  const stop = getAgentEmergencyStop(featureFlag);
  if (stop) return { enabled: false, source: stop };
  try {
    const control = await prisma.agentControl.findUnique({ where: { agentName } });
    return getAgentActivationState(featureFlag, control?.enabledOverride ?? null, isAgentEnabled(featureFlag));
  } catch (e) {
    logger.warn("[agent.control] override lookup failed, using env flag", {
      agentName,
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
  }
  const state = getAgentActivationState(featureFlag, null, isAgentEnabled(featureFlag));
  return state.source === "env_flag" || state.source === "default_disabled" ? { ...state, source: "env_fallback" } : state;
}

/** Set (or clear, with null) an agent's kill-switch override. */
export async function setAgentControl(
  agentName: string,
  enabledOverride: boolean | null,
  updatedBy: string
): Promise<void> {
  if (!updatedBy?.trim()) throw Object.assign(new Error("Authenticated actor required"), { status: 403 });
  await prisma.$transaction(async tx => {
    const previous = await tx.agentControl.findUnique({ where: { agentName } });
    await tx.agentControl.upsert({
      where: { agentName },
      create: { agentName, enabledOverride, updatedBy },
      update: { enabledOverride, updatedBy },
    });
    await tx.auditLog.create({ data: {
      userId: updatedBy, action: "agent.control.updated", resourceType: "AgentControl", resourceId: agentName,
      details: { previousOverride: previous?.enabledOverride ?? null, enabledOverride },
    } });
  });
}

/** All overrides keyed by agentName (for the admin dashboard). */
export async function getAllControls(): Promise<Record<string, boolean | null>> {
  const rows = await prisma.agentControl.findMany();
  const out: Record<string, boolean | null> = {};
  for (const r of rows) out[r.agentName] = r.enabledOverride ?? null;
  return out;
}
