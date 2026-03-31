type AiUsageInput = {
  estimatedCostUSD?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
};

export function getAiUsageMetrics(input: AiUsageInput) {
  const inputTokens =
    typeof input.inputTokens === "number" && Number.isFinite(input.inputTokens)
      ? Math.max(0, input.inputTokens)
      : 0;
  const outputTokens =
    typeof input.outputTokens === "number" && Number.isFinite(input.outputTokens)
      ? Math.max(0, input.outputTokens)
      : 0;
  const estimatedCostUSD =
    typeof input.estimatedCostUSD === "number" && Number.isFinite(input.estimatedCostUSD)
      ? Math.max(0, input.estimatedCostUSD)
      : 0;

  return {
    tokensUsed: inputTokens + outputTokens,
    estimatedCostUSD,
    model: input.model ?? null,
  };
}
