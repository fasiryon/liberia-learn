/**
 * Shared governed progression threshold. The Learning Orchestrator uses it to
 * gate prerequisite edges; calibration projections use the same value to
 * report prerequisite status so the two can never disagree.
 */
export const PREREQUISITE_PROGRESSION_THRESHOLD = 0.8 as const;
