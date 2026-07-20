/**
 * Sprint 6.8: age-safety checking. Sprint 6.2's content-qa agent already has
 * a `grade_appropriateness` rubric criterion (lib/agents/tools/contentqa.tools.ts,
 * LESSON_QUALITY_CRITERIA) -- real infrastructure -- but AGENT_CONTENT_QA_ENABLED
 * is off and ContentQaReview has zero real rows. This module reports that
 * honestly rather than flipping the flag as a side effect of wanting a number
 * for this dashboard (explicit instruction: that's a separate decision about
 * content-qa's own rollout).
 */
import { prisma } from "@/lib/db";
import { isAgentEnabled } from "@/lib/agents/flags";

export type AgeSafetyMetric = {
  measurable: false;
  agentEnabled: boolean;
  realReviewCount: number;
  reason: string;
};

export async function getAgeSafetyMetric(): Promise<AgeSafetyMetric> {
  const [agentEnabled, realReviewCount] = await Promise.all([
    Promise.resolve(isAgentEnabled("AGENT_CONTENT_QA_ENABLED")),
    prisma.contentQaReview.count(),
  ]);

  return {
    measurable: false,
    agentEnabled,
    realReviewCount,
    reason: agentEnabled
      ? `content-qa is enabled but has recorded ${realReviewCount} real reviews so far -- not yet enough to trend.`
      : "Infrastructure exists (content-qa's grade_appropriateness rubric criterion) but AGENT_CONTENT_QA_ENABLED is off, so zero real content has ever been scored. Enabling content-qa is a separate decision outside this sprint's scope.",
  };
}
