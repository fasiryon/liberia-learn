import type { FidelityState, HighFidelitySpec } from "./types";
import { deriveSimulation } from "./engine";

/** Presentation copy follows the same state as the scene; it never changes learning evidence. */
export function guidedPrompt(spec: HighFidelitySpec, state: FidelityState): string | undefined {
  const step = spec.guidedPath[state.guidedStepIndex];
  return step?.promptForState?.(state, deriveSimulation(spec, state)) ?? step?.prompt;
}
