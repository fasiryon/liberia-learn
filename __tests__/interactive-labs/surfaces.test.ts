// RX-005b: quantity-bound surfaces. The renderer draws; the model decides.
import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { createSurfaceTriangleStorage, resolveSurfaces, surfaceRibbon, validateSurfaces, writeSurfaceTriangles } from "@/lib/interactive-labs/v2/fidelity/surfaces";
import { validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { initializeLab, acceptLabAction } from "@/lib/interactive-labs/v2/kernel";
import type { LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import type { HighFidelitySpec } from "@/lib/interactive-labs/v2/fidelity/types";

const spec = hydropowerDefinition.fidelity!;
const play = (actions: LabAction[]): LabState => actions.reduce((state, action) => {
  const result = acceptLabAction(hydropowerDefinition, state, action);
  if ("reason" in result) throw new Error(result.reason);
  return result.state;
}, initializeLab(hydropowerDefinition));
const set = (variableId: string, value: number): LabAction => ({ type: "set-variable", variableId, value });
const surfacesAt = (state: LabState) => Object.fromEntries(buildRenderList({ definition: hydropowerDefinition, state, profile: "HIGH" }).surfaces.map((surface) => [surface.id, surface]));

describe("surface geometry", () => {
  it("builds a deterministic flat ribbon with along/across coordinates", () => {
    const a = surfaceRibbon([[0, 0, 0], [2, 0, 0], [4, 0, 0]], 1);
    expect(a.triangles).toBe(4);
    expect(Array.from(a.positions.slice(0, 6))).toEqual([0, 0, -0.5, 0, 0, 0.5]);
    expect(Array.from(a.uvs.slice(-4))).toEqual([4, 0, 4, 1]);
    expect(surfaceRibbon([[0, 0, 0], [2, 0, 0], [4, 0, 0]], 1)).toEqual(a);
  });

  it("hangs a sheet down a face with a horizontal side vector", () => {
    const sheet = surfaceRibbon([[1, 2, 0], [1, 0, 1]], 2);
    expect(Array.from(sheet.positions.slice(0, 6)).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([2, 2, 0, 0, 2, 0]);
  });

  it("puts every active surface in one LOW batch, and none when inactive", () => {
    const storage = createSurfaceTriangleStorage();
    const surfaces = [{ id: "a", label: "a", kind: "channel" as const, medium: "water" as const, points: [[0, 0, 0], [1, 0, 0]] as [number, number, number][], width: 1, active: true, rate: 0.5 }];
    expect(writeSurfaceTriangles(surfaces, storage).count).toBe(12);
    expect(writeSurfaceTriangles([{ ...surfaces[0], active: false, width: 0 }], storage).count).toBe(0);
  });
});

describe("surface authoring gate", () => {
  it("rejects short paths, bad widths, unknown quantities and unknown components", () => {
    const bad: HighFidelitySpec = { ...spec, surfaces: [{ id: "x", label: "x", kind: "channel", medium: "water", path: [[0, 0, 0]], baseWidth: 0, widthQuantity: "nope", componentId: "ghost" }] };
    expect(validateSurfaces(bad, { real: 1 })).toEqual(["surface_path_too_short:x", "surface_width_invalid:x", "surface_quantity_unknown:x:nope", "surface_component_unknown:x"]);
  });

  it("passes for Mount Coffee", () => {
    expect(validateHighFidelityDefinition(hydropowerDefinition)).toEqual([]);
  });
});

describe("Mount Coffee water follows the model (07 water language)", () => {
  it("the dry season shrinks both rivers equally while the headpond never moves", () => {
    const rainy = surfacesAt(play([]));
    const dry = surfacesAt(play([set("riverFlow", 49)]));
    expect(dry["water-upstream"].width).toBeLessThan(rainy["water-upstream"].width * 0.4);
    for (const state of [rainy, dry]) expect(state["water-downstream"].width / state["water-upstream"].width).toBeCloseTo(1.6 / 1.5, 3);
    expect(dry["water-headpond"]).toEqual(rainy["water-headpond"]);
    expect(rainy["water-headpond"].rate).toBe(0);
  });

  it("spill appears only when water goes over the spillway, and fills the river on a trip", () => {
    expect(surfacesAt(play([]))["water-spill"].active).toBe(false);
    expect(surfacesAt(play([set("riverFlow", 557)]))["water-spill"].active).toBe(true);
    const tripped = surfacesAt(play([set("riverFlow", 49)]));
    expect(tripped["water-tailrace"].active).toBe(false);
    expect(tripped["water-spill"].active).toBe(true);
  });

  it("is identical on every profile (instructional equivalence)", () => {
    const state = play([set("riverFlow", 176), set("unitsOnline", 2)]);
    const views = (["HIGH", "STANDARD", "LOW", "FALLBACK_2D"] as const).map((profile) => instructionalView(buildRenderList({ definition: hydropowerDefinition, state, profile })).surfaces);
    for (const view of views) expect(view).toEqual(views[0]);
    expect(resolveSurfaces(spec, {}).every((surface) => !surface.active || surface.id === "water-headpond" || surface.width === 0)).toBe(true);
  });
});
