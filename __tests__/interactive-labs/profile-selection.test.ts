import { describe, expect, it } from "vitest";
import {
  PROBE_MIN_SAMPLES, probeAllowsUpgrade, recallProfile, rememberProfile, resolveInitialProfile,
  upgradeEligibility, upgradeTarget,
} from "@/lib/interactive-labs/v2/capabilities";
import { recordFrameSample, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { loadChunkWithRetry } from "@/lib/interactive-labs/v2/loadChunk";

describe("RX-005 profile selection", () => {
  it("starts on LOW with WebGL and FALLBACK_2D without it, unless a choice is already resolved", () => {
    expect(resolveInitialProfile({ supportsWebGL: true })).toBe("LOW");
    expect(resolveInitialProfile({ supportsWebGL: false })).toBe("FALLBACK_2D");
    expect(resolveInitialProfile({ supportsWebGL: true, remembered: "STANDARD" })).toBe("STANDARD");
    expect(resolveInitialProfile({ supportsWebGL: false, requested: "HIGH" })).toBe("HIGH");
  });

  it("blocks upgrades for constrained memory, Save-Data and slow networks", () => {
    expect(upgradeEligibility({ deviceMemoryGb: 2 })).toBe(false);
    expect(upgradeEligibility({ saveData: true })).toBe(false);
    expect(upgradeEligibility({ effectiveType: "3g" })).toBe(false);
    expect(upgradeEligibility({ effectiveType: "slow-2g" })).toBe(false);
    expect(upgradeEligibility({ deviceMemoryGb: 8, effectiveType: "4g" })).toBe(true);
    expect(upgradeEligibility({})).toBe(true); // Safari/Firefox may omit these hints; the probe still applies.
  });

  it("requires 30 fast LOW frames before upgrading and respects reduced motion", () => {
    expect(probeAllowsUpgrade(Array(29).fill(8))).toBe(false);
    expect(probeAllowsUpgrade(Array(PROBE_MIN_SAMPLES).fill(12))).toBe(true);
    expect(probeAllowsUpgrade(Array(PROBE_MIN_SAMPLES).fill(12.1))).toBe(false);
    expect(probeAllowsUpgrade([...Array(29).fill(8), Number.NaN])).toBe(false);
    expect(upgradeTarget({ reducedMotion: false })).toBe("HIGH");
    expect(upgradeTarget({ reducedMotion: true })).toBe("STANDARD");
  });

  it("does not count idle gaps or intentionally skipped frames as slow device samples", () => {
    let samples: number[] = [];
    for (let i = 0; i < 59; i++) samples = recordFrameSample(samples, 16, true);
    samples = recordFrameSample(samples, 400, false);
    expect(samples).toHaveLength(0);
    expect(shouldDowngrade(samples, 19.2)).toBe(false);
    for (let i = 0; i < 60; i++) samples = recordFrameSample(samples, 34, false); // intentional 30 fps cap skip
    expect(samples).toHaveLength(0);
    samples = Array.from({ length: 60 }, () => 25);
    expect(shouldDowngrade(samples, 19.2)).toBe(true);
    samples = [];
    for (let i = 0; i < 60; i++) samples = recordFrameSample(samples, 100, true); // slow, but continuously scheduled
    expect(shouldDowngrade(samples, 19.2)).toBe(true);
  });

  it("remembers valid profiles and tolerates unavailable or malformed storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    rememberProfile(storage, "LOW");
    expect(recallProfile(storage)).toBe("LOW");
    values.set("ll-lab-profile/rx005-1", "NOT_A_PROFILE");
    expect(recallProfile(storage)).toBeNull();
    expect(recallProfile({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} })).toBeNull();
    expect(() => rememberProfile({ getItem: () => null, setItem: () => { throw new Error("blocked"); } }, "HIGH")).not.toThrow();
    expect(recallProfile(null)).toBeNull();
  });

  it("retries a renderer chunk once, then propagates failure for the 2D error boundary", async () => {
    let attempts = 0;
    const loaded = await loadChunkWithRetry(async () => {
      attempts++;
      if (attempts === 1) throw new Error("transient chunk failure");
      return "renderer";
    }, async () => {});
    expect(loaded).toBe("renderer");
    expect(attempts).toBe(2);
    attempts = 0;
    await expect(loadChunkWithRetry(async () => { attempts++; throw new Error("offline"); }, async () => {})).rejects.toThrow("offline");
    expect(attempts).toBe(2);
  });
});
