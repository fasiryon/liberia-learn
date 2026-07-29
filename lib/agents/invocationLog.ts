import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { roundUSD } from "@/lib/agents/money";
import type {
  InvocationStatus,
  ToolCallRecord,
  TriggeredBy,
} from "@/lib/agents/types";

export interface PersistInvocationInput {
  agentName: string;
  agentVersion: string;
  goalId?: string | null;
  userId?: string | null;
  triggeredBy: TriggeredBy;
  input: unknown;
  output?: unknown;
  toolCalls: ToolCallRecord[];
  llmTokensIn: number;
  llmTokensOut: number;
  llmCostUSD: number;
  toolCostUnits: number;
  latencyMs: number;
  status: InvocationStatus;
  errorMessage?: string | null;
  escalationReason?: string | null;
  schoolId?: string | null;
  traceId?: string | null;
}

/** Persist one AgentInvocation and its correlated audit record atomically. */
export async function persistInvocation(
  input: PersistInvocationInput
): Promise<{ id: string }> {
  const row = (await withDbWriteThrottle("agent.invocation.persist", () =>
    prisma.$transaction(async (tx) => {
      const invocation = await tx.agentInvocation.create({
        data: {
          agentName: input.agentName,
          agentVersion: input.agentVersion,
          goalId: input.goalId ?? null,
          userId: input.userId ?? null,
          triggeredBy: input.triggeredBy,
          input: (input.input ?? {}) as object,
          output: (input.output ?? undefined) as object | undefined,
          toolCalls: input.toolCalls as unknown as object,
          llmTokensIn: input.llmTokensIn,
          llmTokensOut: input.llmTokensOut,
          llmCostUSD: roundUSD(input.llmCostUSD),
          toolCostUnits: input.toolCostUnits,
          latencyMs: input.latencyMs,
          status: input.status,
          errorMessage: input.errorMessage ?? null,
          escalationReason: input.escalationReason ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: "agent.invocation",
          resourceType: "AgentInvocation",
          resourceId: invocation.id,
          traceId: input.traceId ?? null,
          schoolId: input.schoolId ?? null,
          details: {
            agentName: input.agentName,
            agentVersion: input.agentVersion,
            status: input.status,
            triggeredBy: input.triggeredBy,
            llmCostUSD: roundUSD(input.llmCostUSD),
            toolCostUnits: input.toolCostUnits,
          },
        },
      });

      return invocation;
    })
  )) as { id: string };

  return { id: row.id };
}
