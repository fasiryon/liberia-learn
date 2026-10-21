import { describe, expect, it } from "vitest";
import { circuitDefinition } from "@/lib/interactive-labs/v2/definitions/circuit";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { animatedMatrix, presentRenderList } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { transformPoint } from "@/lib/interactive-labs/v2/fidelity/math";
import { planLowBatches } from "@/lib/interactive-labs/v2/fidelity/lowBatch";

describe("bounded deterministic instructional particle presentation", () => {
  const base = buildRenderList({ definition: circuitDefinition, state: initializeLab(circuitDefinition), profile: "LOW" });
  const item = { ...base.items[0], translation: { seed: 7, amplitude: [0.1, 0.2, 0.05] as [number, number, number], frequency: 2 } };
  it("moves within model bounds without changing size, and freezes deterministically", () => {
    const center = transformPoint(item.matrix, [0, 0, 0]);
    for (const time of [0, 0.1, 1, 20, 1000]) {
      const matrix = animatedMatrix(item, time, false), point = transformPoint(matrix, [0, 0, 0]);
      point.forEach((v, axis) => expect(Math.abs(v - center[axis])).toBeLessThanOrEqual(item.translation.amplitude[axis] + 1e-8));
      expect(matrix.slice(0, 12)).toEqual(item.matrix.slice(0, 12));
      expect(animatedMatrix(item, time, false)).toEqual(matrix);
    }
    expect(animatedMatrix(item, 1, true)).toEqual(animatedMatrix(item, 1000, true));
  });
  it("uses the moving matrix for both visual geometry and picking/label anchors", () => {
    const list = presentRenderList({ ...base, items: [item] }, 1, false);
    expect(list.items[0].center).toEqual(transformPoint(list.items[0].matrix, [0, 0, 0]));
    expect(list.items[0].matrix).not.toEqual(item.matrix);
    expect(planLowBatches({ ...base, items: [item, { ...item, id: "second-particle" }] }).singles).toHaveLength(2);
  });
});
