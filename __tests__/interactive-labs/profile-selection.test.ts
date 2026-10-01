import { describe, expect, it } from "vitest";
import {
  PROBE_MIN_SAMPLES, probeAllowsUpgrade, recallProfile, rememberProfile, resolveCapabilityProfile,
  resolveInitialProfile, upgradeEligibility, upgradeTarget,
} from "@/lib/interactive-labs/v2/capabilities";
import { recordFrameSample, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { downgradeFrameBudgetMs } from "@/lib/interactive-labs/v2/production/budgets";

// RX-005 A2 (start at the floor, upgrade on evidence) and A4 (sample only back-to-back frames).
describe("profile selection starts at the floor", () => {
  it("starts on LOW with WebGL and on FALLBACK_2D without, whatever the device claims", () => {
    expect(resolveInitialProfile({ supportsWebGL: true })).toBe("LOW");
    expect(resolveInitialProfile({ supportsWebGL: true, remembered: null })).toBe("LOW");
    expect(resolveInitialProfile({ supportsWebGL: false })).toBe("FALLBACK_2D");
  });

  it("lets a manual or review choice win", () => {
    expect(resolveInitialProfile({ supportsWebGL: true, requested: "HIGH" })).toBe("HIGH");
    expect(resolveInitialProfile({ supportsWebGL: false, requested: "LOW" })).toBe("LOW");
  });

  it("restores a remembered profile but never above what the device can show", () => {
    expect(resolveInitialProfile({ supportsWebGL: true, remembered: "HIGH" })).toBe("HIGH");
    expect(resolveInitialProfile({ supportsWebGL: false, remembered: "HIGH" })).toBe("FALLBACK_2D");
  });

  it("keeps the legacy resolver contract", () => {
    expect(resolveCapabilityProfile({ supportsWebGL: false })).toBe("FALLBACK_2D");
    expect(resolveCapabilityProfile({ memoryGb: 1 })).toBe("LOW");
  });
});

describe("upgrade eligibility from device hints", () => {
  it("refuses target-device-like hints (TARGET_LOW_DEVICE reports about 2 GB)", () => {
    expect(upgradeEligibility({ deviceMemoryGb: 2 })).toBe(false);
    expect(upgradeEligibility({ deviceMemoryGb: 3 })).toBe(false);
  });

  it("refuses Save-Data and slow connections", () => {
    expect(upgradeEligibility({ deviceMemoryGb: 8, saveData: true })).toBe(false);
    for (const effectiveType of ["slow-2g", "2g", "3g"]) expect(upgradeEligibility({ deviceMemoryGb: 8, effectiveType })).toBe(false);
  });

  it("allows capable devices, and leaves browsers without the memory hint to the probe", () => {
    expect(upgradeEligibility({ deviceMemoryGb: 4, effectiveType: "4g" })).toBe(true);
    expect(upgradeEligibility({})).toBe(true);
  });

  it("upgrades to HIGH, or STANDARD under reduced motion", () => {
    expect(upgradeTarget({ reducedMotion: false })).toBe("HIGH");
    expect(upgradeTarget({ reducedMotion: true })).toBe("STANDARD");
  });
});

describe("headroom probe", () => {
  it("needs enough back-to-back samples", () => {
    expect(probeAllowsUpgrade(Array(PROBE_MIN_SAMPLES - 1).fill(4))).toBe(false);
    expect(probeAllowsUpgrade(Array(PROBE_MIN_SAMPLES).fill(4))).toBe(true);
  });

  it("refuses when LOW itself is not comfortably fast", () => {
    expect(probeAllowsUpgrade(Array(PROBE_MIN_SAMPLES).fill(16.7))).toBe(false);
    expect(probeAllowsUpgrade(Array(PROBE_MIN_SAMPLES).fill(33.4))).toBe(false);
  });
});

describe("remembered profile", () => {
  const memoryStorage = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; };

  it("round-trips a valid profile and ignores junk", () => {
    const storage = memoryStorage();
    rememberProfile(storage, "STANDARD");
    expect(recallProfile(storage)).toBe("STANDARD");
    storage.setItem("ll-lab-profile/rx005-1", "ULTRA");
    expect(recallProfile(storage)).toBeNull();
  });

  it("never throws when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(() => rememberProfile(broken, "HIGH")).not.toThrow();
    expect(recallProfile(broken)).toBeNull();
    expect(recallProfile(null)).toBeNull();
  });
});

describe("downgrade detector samples only back-to-back frames", () => {
  it("ignores idle gaps between on-demand frames", () => {
    let samples: number[] = [];
    // 60 discrete interactions, each drawing a single frame after a 100 ms idle gap.
    for (let i = 0; i < 60; i++) samples = recordFrameSample(samples, 100, false);
    expect(shouldDowngrade(samples, downgradeFrameBudgetMs("HIGH"))).toBe(false);
  });

  it("still downgrades on sustained slow continuous frames", () => {
    let samples: number[] = [];
    for (let i = 0; i < 60; i++) samples = recordFrameSample(samples, 40, true);
    expect(shouldDowngrade(samples, downgradeFrameBudgetMs("HIGH"))).toBe(true);
  });

  it("keeps a bounded window", () => {
    let samples: number[] = [];
    for (let i = 0; i < 500; i++) samples = recordFrameSample(samples, 5, true);
    expect(samples.length).toBe(120);
  });
});

describe("renderer chunk loading", () => {
  it("retries a failed import once, then gives up so the player can downgrade", async () => {
    const { loadWithRetry } = await import("@/lib/interactive-labs/v2/fidelity/loader");
    let calls = 0;
    await expect(loadWithRetry(async () => { calls++; if (calls === 1) throw new Error("ChunkLoadError"); return "scene"; })).resolves.toBe("scene");
    expect(calls).toBe(2);
    calls = 0;
    await expect(loadWithRetry(async () => { calls++; throw new Error("ChunkLoadError"); })).rejects.toThrow("ChunkLoadError");
    expect(calls).toBe(2);
  });
});
