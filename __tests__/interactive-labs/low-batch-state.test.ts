import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createLowBatchScratch, ensureLowBatchScratch, growLowBatchCapacity } from "@/lib/interactive-labs/v2/fidelity/lowBatchState";
import { MAX_LOW_BATCH_VERTICES } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
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

describe("RX-006 batch capacity (test 6, unit level)", () => {
  it("grows geometrically only when a rebuild needs more room, and never past the WebGL1-safe cap", () => {
    expect(growLowBatchCapacity(0, 36, MAX_LOW_BATCH_VERTICES)).toBe(36);
    expect(growLowBatchCapacity(36, 30, MAX_LOW_BATCH_VERTICES)).toBe(36);
    expect(growLowBatchCapacity(36, 40, MAX_LOW_BATCH_VERTICES)).toBe(72);
    expect(growLowBatchCapacity(40_000, 40_001, MAX_LOW_BATCH_VERTICES)).toBe(MAX_LOW_BATCH_VERTICES);
    expect(() => growLowBatchCapacity(0, MAX_LOW_BATCH_VERTICES + 1, MAX_LOW_BATCH_VERTICES)).toThrow("low_batch_over_capacity");
  });

  it("keeps the same staging arrays across in-capacity rebuilds (no allocation), and reports growth", () => {
    const scratch = createLowBatchScratch();
    expect(ensureLowBatchScratch(scratch, 100, MAX_LOW_BATCH_VERTICES)).toBe(true);
    const arrays = [scratch.positions, scratch.normals, scratch.colors, scratch.emissions];
    for (const vertices of [100, 64, 99, 1]) expect(ensureLowBatchScratch(scratch, vertices, MAX_LOW_BATCH_VERTICES)).toBe(false);
    expect([scratch.positions, scratch.normals, scratch.colors, scratch.emissions]).toEqual(arrays);
    expect(arrays.every((array, index) => array === [scratch.positions, scratch.normals, scratch.colors, scratch.emissions][index])).toBe(true);
    expect(ensureLowBatchScratch(scratch, 101, MAX_LOW_BATCH_VERTICES)).toBe(true);
    expect([scratch.capacity, scratch.positions.length, scratch.emissions.length]).toEqual([200, 600, 200]);
  });
});

describe("RX-006 test 5: optional instancing", () => {
  it("is not implemented, so the merged path is the only LOW path and cannot depend on ANGLE_instanced_arrays", () => {
    // The merged fallback alone must meet the LOW budget (test 7, frame-plan.test.ts); with no instanced branch,
    // cues and picking are identical whether or not the extension is present.
    const source = readFileSync(path.join(process.cwd(), "components/interactive-labs/v2/WebGLScene.tsx"), "utf8");
    expect(source).not.toMatch(/ANGLE_instanced_arrays|drawArraysInstanced|drawElementsInstanced|vertexAttribDivisor/);
  });
});
