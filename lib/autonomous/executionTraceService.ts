import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import type { JsonObject } from "@/lib/autonomous/types";

export async function startExecutionTrace(input: {
  traceId: string;
  workflowRunId?: string | null;
  parentTraceId?: string | null;
  spanType: string;
  spanName: string;
  tenantId?: string | null;
  schoolId?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  metadata?: JsonObject | null;
}) {
  return withDbWriteThrottle("autonomous.executionTrace.start", () =>
    (prisma as any).executionTrace.create({
      data: {
        traceId: input.traceId,
        workflowRunId: input.workflowRunId ?? null,
        parentTraceId: input.parentTraceId ?? null,
        spanType: input.spanType,
        spanName: input.spanName,
        status: "started",
        tenantId: input.tenantId ?? null,
        schoolId: input.schoolId ?? null,
        actorType: input.actorType ?? null,
        actorId: input.actorId ?? null,
        metadata: input.metadata ?? undefined,
      },
    })
  );
}

export async function finishExecutionTrace(input: {
  id: string;
  status?: "succeeded" | "failed" | "cancelled";
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: JsonObject | null;
}) {
  const existing = await (prisma as any).executionTrace.findUnique({ where: { id: input.id } });
  const endedAt = new Date();
  const durationMs = existing?.startedAt ? endedAt.getTime() - new Date(existing.startedAt).getTime() : null;
  return withDbWriteThrottle("autonomous.executionTrace.finish", () =>
    (prisma as any).executionTrace.update({
      where: { id: input.id },
      data: {
        status: input.status ?? "succeeded",
        endedAt,
        durationMs,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        metadata: input.metadata ?? existing?.metadata ?? undefined,
      },
    })
  );
}

