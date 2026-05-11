import { createHash, randomUUID } from "crypto";

type ScopeInput = {
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  userId?: string | null;
  deviceId?: string | null;
};

export type ExecutionCorrelation = {
  traceId: string;
  correlationId: string;
  partitionKey: string;
};

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

export function buildWorkflowPartitionKey(input: ScopeInput) {
  const tenantId = clean(input.tenantId);
  const schoolId = clean(input.schoolId);
  const districtId = clean(input.districtId);
  const userId = clean(input.userId);
  const deviceId = clean(input.deviceId);

  if (tenantId) return `tenant:${tenantId}`;
  if (schoolId) return `school:${schoolId}`;
  if (districtId) return `district:${districtId}`;
  if (userId && deviceId) return `user-device:${userId}:${deviceId}`;
  if (userId) return `user:${userId}`;
  return "national:aggregate";
}

export function createExecutionCorrelation(input: ScopeInput & {
  traceId?: string | null;
  correlationId?: string | null;
}): ExecutionCorrelation {
  const partitionKey = buildWorkflowPartitionKey(input);
  return {
    traceId: clean(input.traceId) ?? `wf_${randomUUID()}`,
    correlationId: clean(input.correlationId) ?? `corr_${randomUUID()}`,
    partitionKey,
  };
}

export function buildQueueDeduplicationId(input: {
  workflowRunId: string;
  idempotencyKey?: string | null;
  attempt?: number | null;
}) {
  const base = input.idempotencyKey?.trim() || input.workflowRunId;
  const attempt = Number.isFinite(input.attempt) ? Math.max(0, Number(input.attempt)) : 0;
  return createHash("sha256").update(`${base}:${attempt}`).digest("hex");
}

export function buildQueueGroupId(input: { partitionKey: string; workflowType: string }) {
  return `${input.partitionKey}:${input.workflowType}`.slice(0, 128);
}

