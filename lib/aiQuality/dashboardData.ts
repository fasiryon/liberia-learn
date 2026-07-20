/**
 * Sprint 6.8: single aggregator for the /admin/ai-quality dashboard. Each
 * metric module returns its own `measurable: true | false` discriminant so
 * the page can never accidentally render a fabricated or stale number as
 * current -- a metric with no real data renders its honest reason instead.
 */
import { getGroundednessMetric, type GroundednessMetric } from "@/lib/aiQuality/groundedness";
import { getCurriculumGroundingMetric, type CurriculumGroundingMetric } from "@/lib/aiQuality/curriculumGrounding";
import { getCitationCoverageMetric, type CitationCoverageMetric } from "@/lib/aiQuality/citationCoverage";
import { getAgeSafetyMetric, type AgeSafetyMetric } from "@/lib/aiQuality/ageSafety";
import { getBiasCheckMetric, type BiasCheckMetric } from "@/lib/aiQuality/biasCheck";
import { getLearningCorrelationMetric, type LearningCorrelationMetric } from "@/lib/aiQuality/learningCorrelation";

export type AiQualityDashboardData = {
  generatedAt: string;
  groundedness: GroundednessMetric;
  curriculumGrounding: CurriculumGroundingMetric;
  citationCoverage: CitationCoverageMetric;
  ageSafety: AgeSafetyMetric;
  biasCheck: BiasCheckMetric;
  learningCorrelation: LearningCorrelationMetric;
};

export async function getAiQualityDashboardData(): Promise<AiQualityDashboardData> {
  const [groundedness, curriculumGrounding, citationCoverage, ageSafety, learningCorrelation] = await Promise.all([
    getGroundednessMetric(),
    getCurriculumGroundingMetric(),
    getCitationCoverageMetric(),
    getAgeSafetyMetric(),
    getLearningCorrelationMetric(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    groundedness,
    curriculumGrounding,
    citationCoverage,
    ageSafety,
    biasCheck: getBiasCheckMetric(),
    learningCorrelation,
  };
}
