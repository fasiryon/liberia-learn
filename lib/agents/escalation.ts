import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type EscalationPriority = "LOW" | "MEDIUM" | "HIGH";

export interface EnqueueEscalationInput {
  agentName: string;
  /**
   * Nullable: a tool (e.g. safeguarding.escalate) can fire mid-loop, before
   * the enclosing AgentInvocation row is persisted at the end of runAgent.
   */
  invocationId?: string | null;
  goalId?: string | null;
  userId?: string | null;
  reason: string;
  priority?: EscalationPriority;
  traceId?: string | null;
  schoolId?: string | null;
}

/** Place an item on the human-review escalation queue and audit it. */
export async function enqueueEscalation(
  input: EnqueueEscalationInput
): Promise<{ id: string }> {
  const row = (await prisma.escalationQueue.create({
    data: {
      agentName: input.agentName,
      invocationId: input.invocationId ?? null,
      goalId: input.goalId ?? null,
      userId: input.userId ?? null,
      reason: input.reason,
      priority: input.priority ?? "MEDIUM",
      status: "OPEN",
    },
  })) as { id: string };

  await logAudit({
    userId: input.userId ?? null,
    action: "agent.escalation",
    resourceType: "EscalationQueue",
    resourceId: row.id,
    traceId: input.traceId ?? null,
    schoolId: input.schoolId ?? null,
    details: {
      agentName: input.agentName,
      invocationId: input.invocationId,
      reason: input.reason,
      priority: input.priority ?? "MEDIUM",
    },
  });

  return { id: row.id };
}
