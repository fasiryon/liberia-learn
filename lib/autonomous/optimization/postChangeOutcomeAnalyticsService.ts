import { prisma } from "@/lib/db";

export async function getPostChangeOutcomeAnalytics(input: { schoolId?: string | null } = {}) {
  const changeWhere: any = {};
  if (input.schoolId) changeWhere.schoolId = input.schoolId;
  const plans = await (prisma as any).postChangeEvaluationPlan.findMany({
    where: input.schoolId ? { changeRequest: changeWhere } : {},
    include: { changeRequest: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const complete = plans.filter((plan: any) => plan.feedbackLoopStatus === "COMPLETE").length;
  const collecting = plans.filter((plan: any) => plan.feedbackLoopStatus !== "COMPLETE").length;
  const sparse = plans.filter((plan: any) => plan.postChangeMetrics?.sparseData === true).length;
  const rollbackRecommended = plans.filter((plan: any) => Array.isArray(plan.findings?.findings) && plan.findings.findings.includes("rollback_recommended")).length;
  const improvementConfirmed = plans.filter((plan: any) => Array.isArray(plan.findings?.findings) && plan.findings.findings.includes("improvement_confirmed")).length;
  return {
    plans,
    summary: {
      total: plans.length,
      complete,
      collecting,
      sparse,
      rollbackRecommended,
      improvementConfirmed,
      completionRate: plans.length ? Number((complete / plans.length).toFixed(2)) : 0,
    },
  };
}
