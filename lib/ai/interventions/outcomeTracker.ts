import { prisma } from "@/lib/db";
import type { RecommendationResult } from "@/lib/ai/interventions/recommendationEngine";

export async function recordIntervention(params: {
  tenantId: string;
  schoolId: string;
  districtId?: string;
  result: RecommendationResult;
  aiEnhanced: boolean;
}): Promise<void> {
  try {
    await prisma.interventionLog.create({
      data: {
        tenantId: params.tenantId,
        schoolId: params.schoolId,
        districtId: params.districtId ?? null,
        interventionPriorityScore: params.result.interventionPriorityScore,
        growthRiskFlag: params.result.growthRiskFlag,
        recommendedActionCount: params.result.recommendedActions.length,
        aiEnhanced: params.aiEnhanced,
      },
    });
  } catch (err) {
    console.error("[InterventionLog] Failed to record", err);
  }
}
