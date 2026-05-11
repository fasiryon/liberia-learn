import { logAudit } from "@/lib/audit";

export type ConfigChangeAuditInput = {
  actorId: string | null;
  action: string;
  changeRequestId: string;
  proposalEventId: string;
  category: string;
  affectedScope: string;
  traceId?: string | null;
  schoolId?: string | null;
  details?: Record<string, unknown>;
};

export async function recordConfigChangeAudit(input: ConfigChangeAuditInput) {
  await logAudit({
    userId: input.actorId,
    action: `implementation.${input.action}`,
    resourceType: "OptimizationChangeRequest",
    resourceId: input.changeRequestId,
    traceId: input.traceId ?? null,
    schoolId: input.schoolId ?? null,
    details: {
      proposalEventId: input.proposalEventId,
      category: input.category,
      affectedScope: input.affectedScope,
      policyMutation: false,
      phase: 7,
      ...input.details,
    },
  });
}
