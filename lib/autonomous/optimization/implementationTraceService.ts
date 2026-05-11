import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";

export async function recordImplementationCheckpoint(input: {
  workflowRunId: string;
  checkpointKey: string;
  sequence: number;
  actorId?: string | null;
  traceId?: string | null;
  state?: Record<string, unknown>;
}) {
  const idempotencyKey = `impl-ckpt:${input.workflowRunId}:${input.checkpointKey}:${input.sequence}`;
  const existing = await (prisma as any).workflowCheckpoint.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  return withDbWriteThrottle("implementation.checkpoint", () =>
    (prisma as any).workflowCheckpoint.create({
      data: {
        workflowRunId: input.workflowRunId,
        checkpointKey: input.checkpointKey,
        sequence: input.sequence,
        status: "recorded",
        actorType: input.actorId ? "user" : "system",
        actorId: input.actorId ?? "implementationWorkflow",
        traceId: input.traceId ?? null,
        idempotencyKey,
        state: input.state ?? {},
        evidenceRefs: {},
        executionMetadata: { phase: "7", service: "implementationWorkflow" },
      },
    })
  );
}

export async function recordImplementationStep(input: {
  workflowRunId: string;
  stepKey: string;
  sequence: number;
  status: string;
  traceId?: string | null;
  outputRefs?: Record<string, unknown>;
}) {
  const idempotencyKey = `impl-step:${input.workflowRunId}:${input.stepKey}:${input.sequence}`;
  const existing = await (prisma as any).workflowStep.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.status !== input.status) {
      return withDbWriteThrottle("implementation.step.update", () =>
        (prisma as any).workflowStep.update({
          where: { id: existing.id },
          data: { status: input.status, completedAt: new Date(), outputRefs: input.outputRefs ?? {} },
        })
      );
    }
    return existing;
  }
  return withDbWriteThrottle("implementation.step", () =>
    (prisma as any).workflowStep.create({
      data: {
        workflowRunId: input.workflowRunId,
        stepKey: input.stepKey,
        sequence: input.sequence,
        status: input.status,
        traceId: input.traceId ?? null,
        idempotencyKey,
        outputRefs: input.outputRefs ?? {},
        executionMetadata: { phase: "7" },
        completedAt: ["completed", "succeeded", "failed"].includes(input.status) ? new Date() : null,
      },
    })
  );
}
