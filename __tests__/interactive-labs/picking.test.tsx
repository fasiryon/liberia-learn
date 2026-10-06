import { describe, expect, it } from "vitest";
import { pickNearest } from "@/components/interactive-labs/v2/picking";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { circuitDefinition } from "@/lib/interactive-labs/v2/definitions/circuit";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { renderToStaticMarkup } from "react-dom/server";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { framedPose, findPreset } from "@/lib/interactive-labs/v2/fidelity/camera";
import { fitHorizontalFieldOfView, multiply, perspective, transformPoint } from "@/lib/interactive-labs/v2/fidelity/math";
import { viewMatrix } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { SceneControlBar } from "@/components/interactive-labs/v2/SceneControlBar";

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

  it("inside overlapping projected bounds, the part in front wins even when the one behind has the closer centre", () => {
    // Orthographic front view: x/y map to pixels (50 px per unit), z to depth. Two 2 × 2 boxes overlap on screen.
    const ortho = (p: [number, number, number]) => ({ x: p[0] * 50, y: -p[1] * 50, depth: -p[2] / 10 });
    const box = (id: string, x: number, z: number) => ({ ...sample, id, geometry: "box" as const, parametricGeometry: undefined, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1], center: [x, 0, z] as [number, number, number] });
    const front = box("front", 0, 2), behind = box("behind", 0.8, -2);
    const hit = pickNearest({ ...list, items: [behind, front] }, ortho, { x: 35, y: 0 }, null);
    expect(hit).toMatchObject({ kind: "item", item: { id: "front" } });
    // Outside the front part's bounds but inside the one behind: the one behind is the hit.
    expect(pickNearest({ ...list, items: [behind, front] }, ortho, { x: 85, y: 0 }, null)).toMatchObject({ kind: "item", item: { id: "behind" } });
  });

  it("does not pick a projected center outside the viewport", () => {
    const offscreen = item("offscreen", 0), visible = item("visible", 0.4);
    const clippedProjection = (point: [number, number, number]) => point[0] > 1 ? null : project(point);
    const hit = pickNearest({ ...list, items: [{ ...offscreen, center: [2, 0, 0] }, visible] }, clippedProjection, { x: 0, y: 0 }, null);
    expect(hit).toMatchObject({ kind: "item", item: { id: "visible" } });
  });
});

describe("RX-006 test 4: Mount Coffee controls pick deterministically", () => {
  // Desktop stage (1366 × 640 px) through the real framed camera of each preset; depth is NDC z (nearest wins).
  const WIDTH = 1366, HEIGHT = 640, ASPECT = WIDTH / HEIGHT;
  const definition = hydropowerDefinition, spec = definition.fidelity!;
  const lowList = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
  const projector = (presetId: string) => {
    const pose = framedPose(spec, findPreset(spec, presetId), lowList.items, definition.scene.camera.fov, ASPECT);
    const clip = multiply(perspective(fitHorizontalFieldOfView(definition.scene.camera.fov, ASPECT), ASPECT, 0.1, 100), viewMatrix(pose));
    return (p: [number, number, number]) => {
      const c = transformPoint(clip, p);
      return c[0] < -1 || c[0] > 1 || c[1] < -1 || c[1] > 1 || c[2] < -1 || c[2] > 1 ? null : { x: (c[0] * 0.5 + 0.5) * WIDTH, y: (0.5 - c[1] * 0.5) * HEIGHT, depth: c[2] };
    };
  };
  const controls = lowList.items.filter((item) => item.control);

  it("every gauge band and breaker is the deterministic hit at its own projected centre in at least one preset", () => {
    expect(controls.map((item) => item.id)).toEqual(expect.arrayContaining(["gauge-band-1", "gauge-band-5", "breaker-hospital", "breaker-homes-less", "breaker-shops-more"]));
    for (const control of controls) {
      const hits = spec.camera.presets.flatMap((preset) => {
        const project = projector(preset.id), at = project(control.center);
        if (!at) return [];
        const first = pickNearest(lowList, project, at, null), again = pickNearest({ ...lowList, items: [...lowList.items].reverse() }, project, at, null);
        // Deterministic: the same target regardless of render-list order.
        expect(first?.kind === "item" ? first.item.id : null, `${control.id}@${preset.id}`).toBe(again?.kind === "item" ? again.item.id : null);
        return first?.kind === "item" && first.item.id === control.id ? [preset.id] : [];
      });
      expect(hits.length, control.id).toBeGreaterThan(0);
    }
  });

  it("each pick maps to the same component id as its keyboard/touch twin (one chip per control part)", () => {
    const html = renderToStaticMarkup(<SceneControlBar definition={definition} state={initializeLab(definition)} dispatch={() => {}} />);
    const chipIds = [...html.matchAll(/data-lab-control="([^"]+)"/g)].map((match) => match[1]).sort();
    expect(chipIds).toEqual(controls.map((item) => item.id).sort());
  });
});
