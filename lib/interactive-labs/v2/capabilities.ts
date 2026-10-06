import type { CapabilityProfile } from "./types";

export function resolveCapabilityProfile(input: { requested?: CapabilityProfile; supportsWebGL?: boolean; reducedMotion?: boolean; memoryGb?: number }): CapabilityProfile {
  if (input.requested) return input.requested;
  if (input.supportsWebGL === false) return "FALLBACK_2D";
  if ((input.memoryGb ?? 4) <= 1.5) return "LOW";
  if (input.reducedMotion) return "STANDARD";
  return "HIGH";
}

const PROFILE_ORDER: readonly CapabilityProfile[] = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"];
const PROFILE_STORAGE_KEY = "ll-lab-profile/rx005-1";

/** `webgl2: false` vetoes an upgrade: the HIGH/STANDARD renderer (three.js r186) is WebGL2-only. */
export type DeviceHints = { deviceMemoryGb?: number; saveData?: boolean; effectiveType?: string; webgl2?: boolean };
type ProfileStorage = Pick<Storage, "getItem" | "setItem">;

/** Start with a cheap, universally available experience. Explicit learner choice takes precedence. */
export function resolveInitialProfile(input: { supportsWebGL: boolean; requested?: CapabilityProfile; remembered?: CapabilityProfile | null }): CapabilityProfile {
  if (input.requested) return input.requested;
  if (!input.supportsWebGL) return "FALLBACK_2D";
  return input.remembered ?? "LOW";
}

/** Hints can veto an upgrade; when a browser omits a hint the measured frame probe still decides. */
export function upgradeEligibility(hints: DeviceHints): boolean {
  if (hints.webgl2 === false) return false;
  if (hints.saveData) return false;
  if (hints.effectiveType && ["slow-2g", "2g", "3g"].includes(hints.effectiveType.toLowerCase())) return false;
  if (hints.deviceMemoryGb !== undefined && hints.deviceMemoryGb < 4) return false;
  return true;
}

export function upgradeTarget(input: { reducedMotion: boolean }): CapabilityProfile {
  return input.reducedMotion ? "STANDARD" : "HIGH";
}

export const PROBE_MIN_SAMPLES = 30;
export const PROBE_MAX_MEAN_FRAME_MS = 12;

export function probeAllowsUpgrade(frameTimesMs: readonly number[]): boolean {
  if (frameTimesMs.length < PROBE_MIN_SAMPLES) return false;
  const recent = frameTimesMs.slice(-PROBE_MIN_SAMPLES);
  return recent.every(Number.isFinite) && recent.reduce((sum, value) => sum + value, 0) / recent.length <= PROBE_MAX_MEAN_FRAME_MS;
}

export function readDeviceHints(nav: unknown): DeviceHints {
  const n = (nav ?? {}) as { deviceMemory?: unknown; connection?: { saveData?: unknown; effectiveType?: unknown } };
  return {
    deviceMemoryGb: typeof n.deviceMemory === "number" ? n.deviceMemory : undefined,
    saveData: n.connection?.saveData === true,
    effectiveType: typeof n.connection?.effectiveType === "string" ? n.connection.effectiveType : undefined,
  };
}

export function rememberProfile(storage: ProfileStorage | null | undefined, profile: CapabilityProfile): void {
  try { storage?.setItem(PROFILE_STORAGE_KEY, profile); } catch { /* storage may be disabled */ }
}

/**
 * RX-005 A2 / R3 performance P1: once this device has been downgraded for performance, it is never auto-upgraded
 * again (per runtime version), so a fast LOW probe on a high-refresh screen cannot loop HIGH → LOW → HIGH.
 * A learner's manual choice still applies.
 */
const DOWNGRADE_STORAGE_KEY = "ll-lab-downgraded/rx005-1";
export function rememberPerformanceDowngrade(storage: ProfileStorage | null | undefined): void {
  try { storage?.setItem(DOWNGRADE_STORAGE_KEY, "1"); } catch { /* storage may be disabled */ }
}
export function recallPerformanceDowngrade(storage: ProfileStorage | null | undefined): boolean {
  try { return storage?.getItem(DOWNGRADE_STORAGE_KEY) === "1"; } catch { return false; }
}

export function recallProfile(storage: ProfileStorage | null | undefined): CapabilityProfile | null {
  try {
    const value = storage?.getItem(PROFILE_STORAGE_KEY);
    return typeof value === "string" && PROFILE_ORDER.includes(value as CapabilityProfile) ? value as CapabilityProfile : null;
  } catch { return null; }
}

export const CAPABILITY_MATRIX = Object.freeze({
  HIGH: { lighting: "full", animation: "full", geometry: "full" },
  STANDARD: { lighting: "simplified", animation: "reduced", geometry: "full" },
  LOW: { lighting: "minimal", animation: "reduced", geometry: "low" },
  FALLBACK_2D: { lighting: "none", animation: "reduced", geometry: "svg" },
} as const);
