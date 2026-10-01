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

// RX-005 A2: start at the floor and upgrade on evidence. The expensive HIGH/STANDARD renderer is never
// the first thing a device loads, so TARGET_LOW_DEVICE (Tecno Spark Go class) is never sent it by default.

const PROFILES: readonly CapabilityProfile[] = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"];
const isProfile = (value: unknown): value is CapabilityProfile => typeof value === "string" && (PROFILES as readonly string[]).includes(value);

export type DeviceHints = { deviceMemoryGb?: number; saveData?: boolean; effectiveType?: string };

/** The profile a lab first renders with. A manual choice wins; otherwise LOW (WebGL) or FALLBACK_2D. */
export function resolveInitialProfile(input: { supportsWebGL: boolean; requested?: CapabilityProfile; remembered?: CapabilityProfile | null }): CapabilityProfile {
  if (input.requested) return input.requested;
  if (!input.supportsWebGL) return "FALLBACK_2D";
  return input.remembered ?? "LOW";
}

/**
 * Device hints that rule an upgrade out. `navigator.deviceMemory` is Chromium-only: when it is absent the
 * frame-time probe alone decides (otherwise every Safari and Firefox desktop would be stuck on LOW).
 */
export function upgradeEligibility(hints: DeviceHints): boolean {
  if (hints.saveData) return false;
  if (hints.effectiveType && ["slow-2g", "2g", "3g"].includes(hints.effectiveType)) return false;
  if (hints.deviceMemoryGb !== undefined && hints.deviceMemoryGb < 4) return false;
  return true;
}

export function upgradeTarget(input: { reducedMotion: boolean }): CapabilityProfile {
  return input.reducedMotion ? "STANDARD" : "HIGH";
}

export const PROBE_MIN_SAMPLES = 30;
/** LOW must render well under the HIGH frame budget (19.2 ms) before a heavier renderer is worth trying. */
export const PROBE_MAX_MEAN_FRAME_MS = 12;

/** Back-to-back LOW frame times (see `recordFrameSample`) that show headroom for an upgrade. */
export function probeAllowsUpgrade(frameTimesMs: readonly number[]): boolean {
  if (frameTimesMs.length < PROBE_MIN_SAMPLES) return false;
  const recent = frameTimesMs.slice(-PROBE_MIN_SAMPLES);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length <= PROBE_MAX_MEAN_FRAME_MS;
}

type ProfileStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
// Bump the suffix when the renderer set changes so stale choices are not reused.
const PROFILE_KEY = "ll-lab-profile/rx005-1";

export function rememberProfile(storage: ProfileStorage | null | undefined, profile: CapabilityProfile): void {
  try { storage?.setItem(PROFILE_KEY, profile); } catch { /* storage blocked: the probe simply runs again next time */ }
}

export function recallProfile(storage: ProfileStorage | null | undefined): CapabilityProfile | null {
  try { const value = storage?.getItem(PROFILE_KEY); return isProfile(value) ? value : null; } catch { return null; }
}

/** Reads the browser's hints defensively; every field is optional and non-Chromium browsers omit most. */
export function readDeviceHints(nav: unknown): DeviceHints {
  const n = (nav ?? {}) as { deviceMemory?: unknown; connection?: { saveData?: unknown; effectiveType?: unknown } };
  return {
    deviceMemoryGb: typeof n.deviceMemory === "number" ? n.deviceMemory : undefined,
    saveData: n.connection?.saveData === true,
    effectiveType: typeof n.connection?.effectiveType === "string" ? n.connection.effectiveType : undefined,
  };
}
