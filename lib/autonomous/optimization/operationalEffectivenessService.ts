import { prisma } from "@/lib/db";
import { getPilotOutcomeAnalytics } from "@/lib/autonomous/evaluation/pilotOutcomeAnalyticsService";
import { getApprovalSLAAnalytics } from "@/lib/autonomous/actions/approvalSLAService";
import { getExecutionHealth } from "@/lib/autonomous/actions/executionHealthService";

function ratio(count: number, total: number) {
  return total > 0 ? Number((count / total).toFixed(2)) : 0;
}

export async function getOperationalEffectivenessMetrics(input: { schoolId?: string | null } = {}) {
  const where: any = {};
  if (input.schoolId) where.schoolId = input.schoolId;
  const [pilot, sla, health, workflows, actions] = await Promise.all([
    getPilotOutcomeAnalytics(input),
    getApprovalSLAAnalytics(input),
    getExecutionHealth(input),
    (prisma as any).workflowRun.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 }),
    (prisma as any).actionExecution.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);
  const completedWorkflows = workflows.filter((workflow: any) => ["completed", "succeeded"].includes(String(workflow.status).toLowerCase())).length;
  const failedWorkflows = workflows.filter((workflow: any) => ["failed", "cancelled"].includes(String(workflow.status).toLowerCase())).length;
  const rollbacks = actions.filter((action: any) => action.rollbackStatus === "COMPLETED" || action.rollbackStatus === "completed").length;
  const failedActions = actions.filter((action: any) => action.status === "FAILED").length;
  return {
    pilot,
    approvalSLA: sla,
    workerHealth: health,
    workflowStability: ratio(completedWorkflows, completedWorkflows + failedWorkflows),
    executionSuccessRate: ratio(actions.filter((action: any) => action.status === "EXECUTED").length, actions.length),
    rollbackFrequency: ratio(rollbacks, actions.length),
    actionFailureRate: ratio(failedActions, actions.length),
  };
}
