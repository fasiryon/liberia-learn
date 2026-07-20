/**
 * Sprint 6.8, Escalation Point 3: after investigation, no defensible
 * conservative bias-check scope was identified. An LLM-judge "detect
 * stereotyping" check would have no held-out ground truth to validate
 * against (unlike the RAG evals' expectedChunkIds or the essay rubric's
 * fixed criteria); a deterministic name/gender/role-tagging check would
 * require building a Liberian-name demographic classifier from scratch,
 * with no existing dictionary anywhere in this codebase to reuse. Either
 * path risks shipping something vague that provides false assurance, which
 * this sprint's own constraints explicitly rule out. Reported as a real
 * gap with no scoring logic behind it -- not a shallow placeholder.
 */
export type BiasCheckMetric = {
  measurable: false;
  reason: string;
};

export function getBiasCheckMetric(): BiasCheckMetric {
  return {
    measurable: false,
    reason:
      "No defensible starting scope identified this sprint. An LLM-judge stereotyping check has no ground truth to validate against; a deterministic name/demographic check would require new classifier infrastructure this codebase has no basis for. Not built rather than shipped thin.",
  };
}
