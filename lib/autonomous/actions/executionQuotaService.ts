import { prisma } from "@/lib/db";
import { isLowRiskAutonomyEnabled } from "@/lib/serverFlags";
import type { ExecutionGuardResult } from "@/lib/autonomous/actions/types";

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getExecutionQuotaPolicy() {
  return {
    tenantHourlyLimit: numberFromEnv("LOW_RISK_AUTONOMY_TENANT_HOURLY_LIMIT", 25),
    globalHourlyLimit: numberFromEnv("LOW_RISK_AUTONOMY_GLOBAL_HOURLY_LIMIT", 250),
    actionHourlyLimit: numberFromEnv("LOW_RISK_AUTONOMY_ACTION_HOURLY_LIMIT", 50),
  };
}

export async function evaluateExecutionQuota(input: {
  actionType: string;
  schoolId?: string | null;
  now?: Date;
}): Promise<ExecutionGuardResult> {
  if (!isLowRiskAutonomyEnabled()) {
    return { allowed: false, reason: "low_risk_autonomy_disabled" };
  }
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - 60 * 60_000);
  const policy = getExecutionQuotaPolicy();
  const terminalStatuses = ["EXECUTED", "APPROVED"];

  const [globalCount, actionCount, tenantCount] = await Promise.all([
    (prisma as any).actionExecution.count({
      where: { status: { in: terminalStatuses }, completedAt: { gte: since } },
    }),
    (prisma as any).actionExecution.count({
      where: { actionType: input.actionType, status: { in: terminalStatuses }, completedAt: { gte: since } },
    }),
    input.schoolId
      ? (prisma as any).actionExecution.count({
          where: { schoolId: input.schoolId, status: { in: terminalStatuses }, completedAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  if (globalCount >= policy.globalHourlyLimit) return { allowed: false, reason: "global_quota_exceeded", metrics: { globalCount, policy } };
  if (actionCount >= policy.actionHourlyLimit) return { allowed: false, reason: "action_quota_exceeded", metrics: { actionCount, policy } };
  if (input.schoolId && tenantCount >= policy.tenantHourlyLimit) {
    return { allowed: false, reason: "tenant_quota_exceeded", metrics: { tenantCount, policy } };
  }
  return { allowed: true, reason: "quota_available", metrics: { globalCount, actionCount, tenantCount, policy } };
}

