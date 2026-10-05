import { describe, expect, it } from "vitest";
import { pickNearest } from "@/components/interactive-labs/v2/picking";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { circuitDefinition } from "@/lib/interactive-labs/v2/definitions/circuit";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";

const list = buildRenderList({ definition: circuitDefinition, state: initializeLab(circuitDefinition), profile: "LOW" });
const sample = list.items.find((item) => item.selectable && item.detail !== "decor")!;
const item = (id: string, depth: number) => ({ ...sample, id, center: [0, 0, depth] as [number, number, number] });
const project = (point: [number, number, number]) => ({ x: point[0], y: point[1], depth: point[2] });

describe("RX-006 CPU picking across merged geometry", () => {
  it("chooses the nearest visible eligible component in overlapping hit regions", () => {
    const front = item("front-part", -0.7), back = item("back-part", 0.6);
    const hit = pickNearest({ ...list, items: [back, front] }, project, { x: 0, y: 0 }, null);
    expect(hit).toMatchObject({ kind: "item", item: { id: "front-part" } });
  });

  it("uses stable component-id order for exact depth and distance ties", () => {
    const a = item("a-component", 0), z = item("z-component", 0);
    const hit = pickNearest({ ...list, items: [z, a] }, project, { x: 0, y: 0 }, null);
    expect(hit).toMatchObject({ kind: "item", item: { id: "a-component" } });
  });

  it("ignores projections clipped beyond the camera depth range", () => {
    const behind = item("behind-camera", 1.1), visible = item("visible", 0.4);
    const hit = pickNearest({ ...list, items: [behind, visible] }, project, { x: 0, y: 0 }, null);
    expect(hit).toMatchObject({ kind: "item", item: { id: "visible" } });
  });
});
