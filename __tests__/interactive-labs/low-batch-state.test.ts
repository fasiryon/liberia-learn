import { describe, expect, it } from "vitest";
import { LOW_BATCH_COLOR_CHANGED, LOW_BATCH_EMISSIVE_CHANGED, syncLowBatchItemState, type LowBatchStateRange } from "@/lib/interactive-labs/v2/fidelity/lowBatchState";

const range = (color: string, emissive: number): LowBatchStateRange => ({ color, emissive, colorData: new Float32Array(9), emissiveData: new Float32Array(3) });

describe("RX-006 per-item LOW batch attributes", () => {
  it("uploads only the changed component's color/emission ranges and reuses their storage", () => {
    const runner = range("#000000", 0), bearing = range("#ffffff", 0.1);
    const runnerColorStorage = runner.colorData, runnerEmissionStorage = runner.emissiveData;
    const bearingColorBefore = bearing.colorData.slice(), bearingEmissionBefore = bearing.emissiveData.slice();

    expect(syncLowBatchItemState(runner, { color: "#22c55e", emissive: 0.8 })).toBe(LOW_BATCH_COLOR_CHANGED | LOW_BATCH_EMISSIVE_CHANGED);
    expect(syncLowBatchItemState(runner, { color: "#22c55e", emissive: 0.8 })).toBe(0);
    expect(runner.colorData).toEqual(new Float32Array([34 / 255, 197 / 255, 94 / 255, 34 / 255, 197 / 255, 94 / 255, 34 / 255, 197 / 255, 94 / 255]));
    expect(runner.emissiveData).toEqual(new Float32Array([0.8, 0.8, 0.8]));
    expect(runner.colorData).toBe(runnerColorStorage);
    expect(runner.emissiveData).toBe(runnerEmissionStorage);
    expect(bearing.colorData).toEqual(bearingColorBefore);
    expect(bearing.emissiveData).toEqual(bearingEmissionBefore);
  });

  it("returns independent upload flags when only one visual property changes", () => {
    const item = range("#111111", 0.2);
    expect(syncLowBatchItemState(item, { color: "#222222", emissive: 0.2 })).toBe(LOW_BATCH_COLOR_CHANGED);
    expect(syncLowBatchItemState(item, { color: "#222222", emissive: 0.6 })).toBe(LOW_BATCH_EMISSIVE_CHANGED);
  });
});
