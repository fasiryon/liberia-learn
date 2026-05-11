import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isActionRollbackEnabled } from "@/lib/serverFlags";
import { recordActionTrace } from "@/lib/autonomous/actions/actionTraceService";

export function validateRollbackPlan(action: any) {
  const refs = action?.rollbackRefs ?? {};
  const reversible = refs.reversible !== false;
  const operation = typeof refs.operation === "string" ? refs.operation : null;
  if (!reversible || !operation) {
    return { allowed: false, reason: "rollback_plan_missing_or_irreversible" };
  }
  return { allowed: true, reason: "rollback_available", operation };
}

export async function enforceRollbackAvailability(action: any) {
  const validation = validateRollbackPlan(action);
  if (validation.allowed) return validation;
  await (prisma as any).actionExecution.update({
    where: { id: action.id },
    data: {
      riskLevel: action.riskLevel === "critical" ? "critical" : "high",
      rollbackStatus: "unavailable",
      executionMetadata: { ...(action.executionMetadata ?? {}), rollbackBlockedReason: validation.reason },
    },
  });
  return validation;
}

export async function rollbackActionExecution(input: {
  actionExecutionId: string;
  actorId?: string | null;
  reason?: string | null;
}) {
  if (!isActionRollbackEnabled()) throw Object.assign(new Error("Action rollback is disabled"), { status: 404, code: "rollback_disabled" });
  const action = await (prisma as any).actionExecution.findUnique({ where: { id: input.actionExecutionId } });
  if (!action) throw Object.assign(new Error("ActionExecution not found"), { status: 404 });
  const validation = validateRollbackPlan(action);
  if (!validation.allowed) throw Object.assign(new Error("Rollback unavailable"), { status: 409, code: validation.reason });

  const updated = (await withDbWriteThrottle("autonomous.action.rollback", () =>
    (prisma as any).actionExecution.update({
      where: { id: action.id },
      data: {
        rollbackStatus: "rolled_back",
        executionMetadata: {
          ...(action.executionMetadata ?? {}),
          rollback: {
            rolledBackAt: new Date().toISOString(),
            rolledBackBy: input.actorId ?? null,
            reason: input.reason ?? null,
            operation: validation.operation,
          },
        },
      },
    })
  )) as any;
  await recordActionTrace({
    workflowRunId: action.workflowRunId,
    actionExecutionId: action.id,
    actionType: action.actionType,
    status: "CANCELLED",
    traceId: action.traceId,
    schoolId: action.schoolId,
    actorId: input.actorId ?? null,
    metadata: { rollback: true, reason: input.reason ?? null },
  });
  await logAudit({
    userId: input.actorId ?? null,
    action: "action.rollback",
    resourceType: "ActionExecution",
    resourceId: action.id,
    traceId: action.traceId,
    schoolId: action.schoolId,
    details: { reason: input.reason ?? null, operation: validation.operation },
  });
  return updated;
}
