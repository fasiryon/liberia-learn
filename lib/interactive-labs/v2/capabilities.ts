import type { CapabilityProfile } from "./types";

export function resolveCapabilityProfile(input: { requested?: CapabilityProfile; supportsWebGL?: boolean; reducedMotion?: boolean; memoryGb?: number }): CapabilityProfile {
  if (input.requested) return input.requested;
  if (input.supportsWebGL === false) return "FALLBACK_2D";
  if ((input.memoryGb ?? 4) <= 1.5) return "LOW";
  if (input.reducedMotion) return "STANDARD";
  return "HIGH";
}

export const CAPABILITY_MATRIX = Object.freeze({
  HIGH: { lighting: "full", animation: "full", geometry: "full" },
  STANDARD: { lighting: "simplified", animation: "reduced", geometry: "full" },
  LOW: { lighting: "minimal", animation: "reduced", geometry: "low" },
  FALLBACK_2D: { lighting: "none", animation: "reduced", geometry: "svg" },
} as const);
