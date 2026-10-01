import type { CapabilityProfile } from "../types";

/** What each capability profile may spend. Instructional content never depends on the budget, only its rendering does. */
export type RenderBudget = {
  profile: CapabilityProfile;
  particlesPerFlow: number;
  /** HIGH/STANDARD clip cut-away geometry in the shader; LOW and FALLBACK_2D hide it instead. */
  shaderClipping: boolean;
  /** Faded context around an isolated part; LOW drops the context entirely to save draw calls. */
  fadeContext: boolean;
  meshDetail: "full" | "low" | "svg";
  lighting: "full" | "simplified" | "minimal" | "none";
  antialias: boolean;
  maxDevicePixelRatio: number;
  pulseHighlights: boolean;
};

export const RENDER_BUDGETS: Readonly<Record<CapabilityProfile, RenderBudget>> = Object.freeze({
  HIGH: { profile: "HIGH", particlesPerFlow: 18, shaderClipping: true, fadeContext: true, meshDetail: "full", lighting: "full", antialias: true, maxDevicePixelRatio: 2, pulseHighlights: true },
  STANDARD: { profile: "STANDARD", particlesPerFlow: 10, shaderClipping: true, fadeContext: true, meshDetail: "full", lighting: "simplified", antialias: false, maxDevicePixelRatio: 1.5, pulseHighlights: false },
  LOW: { profile: "LOW", particlesPerFlow: 4, shaderClipping: false, fadeContext: false, meshDetail: "low", lighting: "minimal", antialias: false, maxDevicePixelRatio: 1, pulseHighlights: false },
  FALLBACK_2D: { profile: "FALLBACK_2D", particlesPerFlow: 6, shaderClipping: false, fadeContext: true, meshDetail: "svg", lighting: "none", antialias: false, maxDevicePixelRatio: 1, pulseHighlights: false },
});

const DOWNGRADE: Readonly<Record<CapabilityProfile, CapabilityProfile>> = Object.freeze({ HIGH: "STANDARD", STANDARD: "LOW", LOW: "FALLBACK_2D", FALLBACK_2D: "FALLBACK_2D" });

/** One step down. Used when a WebGL context fails or sustained frame time exceeds the budget. */
export function downgradeProfile(profile: CapabilityProfile): CapabilityProfile { return DOWNGRADE[profile]; }

const FRAME_SAMPLE_WINDOW = 120;

/** Record only a frame that follows a continuously scheduled loop; idle/intentional gaps reset the window. */
export function recordFrameSample(samples: readonly number[], dtMs: number, backToBack: boolean): number[] {
  if (!backToBack) return [];
  if (!Number.isFinite(dtMs) || dtMs < 0) return samples as number[];
  const next = [...samples, dtMs];
  return next.length > FRAME_SAMPLE_WINDOW ? next.slice(-FRAME_SAMPLE_WINDOW) : next;
}

/** Sustained slow frames (not a single hitch) trigger a downgrade. */
export function shouldDowngrade(frameTimesMs: readonly number[], budgetMs = 50, window = 60): boolean {
  if (frameTimesMs.length < window) return false;
  const recent = frameTimesMs.slice(-window);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length > budgetMs;
}
