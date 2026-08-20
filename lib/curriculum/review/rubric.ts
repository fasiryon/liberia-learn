export const P2B_RUBRIC_KEY = "LIBERIALEARN_CURRICULUM_REVIEW";
export const P2B_RUBRIC_VERSION = 1;

export const RUBRIC_RESPONSE_VALUES = [
  "PASS",
  "CONCERN",
  "FAIL",
  "NOT_APPLICABLE",
] as const;

export type RubricResponseValue = (typeof RUBRIC_RESPONSE_VALUES)[number];

export const P2B_RUBRIC_V1 = [
  "standards_alignment",
  "factual_correctness",
  "age_appropriateness",
  "instructional_clarity_quality",
  "assessment_alignment",
  "localization_cultural_accuracy",
  "accessibility",
  "safety",
  "evidence_source_quality",
  "language_quality",
] as const;

export type RubricDimension = (typeof P2B_RUBRIC_V1)[number];

export type RubricResponses = Partial<
  Record<RubricDimension, { value: RubricResponseValue; note?: string }>
>;

export function validateRubricResponses(
  responses: RubricResponses,
  requiredDimensions: readonly RubricDimension[] = P2B_RUBRIC_V1,
): string[] {
  const errors: string[] = [];
  for (const dimension of requiredDimensions) {
    const response = responses[dimension];
    if (!response) errors.push(`MISSING_RUBRIC_RESPONSE:${dimension}`);
    else if (!RUBRIC_RESPONSE_VALUES.includes(response.value)) {
      errors.push(`INVALID_RUBRIC_RESPONSE:${dimension}`);
    }
  }
  return errors;
}
