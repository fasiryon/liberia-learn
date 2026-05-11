import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { generateDetectorTuningRecommendations } from "@/lib/autonomous/optimization/detectorTuningService";
import { generateRolloutCalibrationRecommendations } from "@/lib/autonomous/optimization/rolloutCalibrationService";
import { recordOptimizationProposal } from "@/lib/autonomous/optimization/optimizationTraceService";
import type { OptimizationRecommendation } from "@/lib/autonomous/optimization/types";

export async function generateOptimizationRecommendations(input: {
  schoolId?: string | null;
  districtId?: string | null;
  detectorId?: string | null;
  persist?: boolean;
  actorId?: string | null;
  isReplay?: boolean;
} = {}) {
  if (!isAutonomousOptimizationEnabled()) {
    throw Object.assign(new Error("Autonomous optimization is disabled"), { status: 404, code: "autonomous_optimization_disabled" });
  }
  const recommendations: OptimizationRecommendation[] = [
    ...(await generateDetectorTuningRecommendations({ schoolId: input.schoolId, detectorId: input.detectorId })),
    ...(await generateRolloutCalibrationRecommendations({ schoolId: input.schoolId, districtId: input.districtId })),
  ];
  if (input.persist === false || input.isReplay === true) {
    return { recommendations, persisted: [] };
  }
  const persisted = [];
  for (const recommendation of recommendations) {
    persisted.push(await recordOptimizationProposal({ recommendation, actorId: input.actorId, isReplay: input.isReplay }));
  }
  return { recommendations, persisted };
}
