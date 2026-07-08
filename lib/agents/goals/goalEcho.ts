import { registerGoalHandler } from "@/lib/agents/goals/goalRegistry";
import type { GoalStepResult } from "@/lib/agents/goals/types";

/**
 * Test-only goal handler that walks every lifecycle transition so the harness
 * can be validated end to end:
 *   step 0 → continue → step 1 → pause_human → (resume) → pause_schedule →
 *   (wake) → complete.
 * Deterministic (no LLM) — it exists to exercise the state machine, not to ship.
 */
export const GOAL_ECHO_AGENT = "goal-echo";

registerGoalHandler(GOAL_ECHO_AGENT, async ({ goal, resumeInput }): Promise<GoalStepResult> => {
  const step = typeof goal.state.step === "number" ? goal.state.step : 0;

  // A human just provided input → schedule a short follow-up before finishing.
  if (resumeInput) {
    return {
      kind: "pause_schedule",
      until: new Date(Date.now() + 1000),
      reason: "follow up after confirmation",
      state: { ...goal.state, step: step + 1, resumeInput },
    };
  }

  if (step === 0) {
    return { kind: "continue", state: { step: 1 } };
  }
  if (step === 1) {
    return { kind: "pause_human", reason: "confirm guardian phone number", state: { step: 2 } };
  }

  // Reached after the scheduled wake.
  return { kind: "complete", state: { step: step + 1, done: true } };
});
