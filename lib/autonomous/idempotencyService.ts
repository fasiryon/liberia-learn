import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { JsonObject } from "@/lib/autonomous/types";

export function buildWorkflowIdempotencyKey(input: {
  workflowType: string;
  partitionKey: string;
  targetType?: string | null;
  targetId?: string | null;
  triggerEventId?: string | null;
  windowKey?: string | null;
}) {
  const parts = [
    input.workflowType,
    input.partitionKey,
    input.targetType ?? "none",
    input.targetId ?? "none",
    input.triggerEventId ?? "none",
    input.windowKey ?? "global",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function buildStepIdempotencyKey(input: {
  workflowRunId: string;
  stepKey: string;
  sequence?: number | null;
}) {
  return createHash("sha256")
    .update(`${input.workflowRunId}:${input.stepKey}:${input.sequence ?? 0}`)
    .digest("hex");
}

export async function findExistingWorkflowRun(idempotencyKey?: string | null) {
  if (!idempotencyKey) return null;
  return (prisma as any).workflowRun?.findUnique?.({ where: { idempotencyKey } }) ?? null;
}

export function toPrismaJson(value?: JsonObject | null) {
  return value ?? undefined;
}

