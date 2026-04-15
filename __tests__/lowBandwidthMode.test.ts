import { describe, expect, it, vi } from "vitest";
import {
  applyLowBandwidthAttribute,
  detectLowBandwidthConnection,
  persistLowBandwidthPreference,
  readLowBandwidthPreference,
  resolveLowBandwidthMode,
} from "@/lib/lowBandwidthMode";

describe("low bandwidth mode", () => {
  it("detects save-data and 2g connections", () => {
    expect(detectLowBandwidthConnection({ saveData: true })).toBe(true);
    expect(detectLowBandwidthConnection({ effectiveType: "2g" })).toBe(true);
    expect(detectLowBandwidthConnection({ effectiveType: "4g" })).toBe(false);
  });

  it("resolves explicit preferences over connection heuristics", () => {
    expect(resolveLowBandwidthMode("on", { effectiveType: "4g" })).toBe(true);
    expect(resolveLowBandwidthMode("off", { saveData: true })).toBe(false);
    expect(resolveLowBandwidthMode("auto", { saveData: true })).toBe(true);
  });

  it("persists and reads preference safely", () => {
    const storage = {
      getItem: vi.fn(() => "on"),
      setItem: vi.fn(),
    };

    persistLowBandwidthPreference(storage, "off");
    expect(storage.setItem).toHaveBeenCalledWith("liberialearn.low_bandwidth_mode", "off");
    expect(readLowBandwidthPreference(storage)).toBe("on");
    expect(readLowBandwidthPreference({ getItem: () => "unexpected" })).toBe("auto");
  });

  it("applies the html dataset flag", () => {
    const root = { dataset: {} as DOMStringMap };
    applyLowBandwidthAttribute(root, true);
    expect(root.dataset.lowBandwidth).toBe("true");
    applyLowBandwidthAttribute(root, false);
    expect(root.dataset.lowBandwidth).toBe("false");
  });
});
