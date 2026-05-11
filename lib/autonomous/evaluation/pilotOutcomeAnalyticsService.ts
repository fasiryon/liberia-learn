import { prisma } from "@/lib/db";

export async function getPilotOutcomeAnalytics(input: { schoolId?: string | null } = {}) {
  const where: any = { riskLevel: "low" };
  if (input.schoolId) where.schoolId = input.schoolId;
  const actions = await (prisma as any).actionExecution.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 });
  const pilots = actions.filter((action: any) => action.outputRefs?.lowRiskPilot === true);
  const executed = pilots.filter((action: any) => action.status === "EXECUTED").length;
  const failed = pilots.filter((action: any) => action.status === "FAILED").length;
  const draftOnly = actions.filter((action: any) => action.outputRefs?.draftOnly === true).length;
  return {
    totalLowRisk: actions.length,
    pilots: pilots.length,
    executed,
    failed,
    draftOnly,
    effectiveness: pilots.length ? Number((executed / pilots.length).toFixed(2)) : 0,
  };
}

