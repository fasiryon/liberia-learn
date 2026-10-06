// R3 visual findings: scene labels are placed only on screen, never overlapping, nearest the frame centre first.
import { describe, expect, it } from "vitest";
import { labelBox, placeSceneLabels } from "@/lib/interactive-labs/v2/fidelity/labelLayout";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { transformPoint } from "@/lib/interactive-labs/v2/fidelity/math";

const viewport = { width: 400, height: 300 };
const c = (id: string, x: number, y: number, highlighted = false) => ({ id, text: id, x, y, highlighted });

describe("placeSceneLabels", () => {
  it("drops labels whose box would be clipped by the scene edge (no fragments)", () => {
    expect(placeSceneLabels([c("Saint Paul River", 5, 150), c("Dam", 200, 10), c("Intake", 200, 150)], viewport, 8).map((label) => label.id)).toEqual(["Intake"]);
  });

  it("skips a label that would overlap one already placed or an obstacle (spin glyph)", () => {
    const placed = placeSceneLabels([c("Headpond", 200, 150), c("Spillway gate", 205, 152), c("Dam", 300, 100)], viewport, 8, [labelBox("Dam", 300, 100)]);
    expect(placed.map((label) => label.id)).toEqual(["Headpond"]);
  });

  it("ranks highlighted parts first, then the parts nearest the frame centre, within the budget", () => {
    const placed = placeSceneLabels([c("Edge", 60, 40), c("Centre", 200, 160), c("Near", 260, 220), c("Lit", 80, 260, true)], viewport, 3);
    expect(placed.map((label) => label.id)).toEqual(["Lit", "Centre", "Near"]);
  });

  it("is deterministic", () => {
    const input = [c("A", 100, 100), c("B", 300, 200), c("C", 200, 150)];
    expect(placeSceneLabels(input, viewport, 8)).toEqual(placeSceneLabels(input, viewport, 8));
  });
});

describe("label anchors stay on their part (part-local offsets)", () => {
  // A world-space offset read as part-local sends the dam/river labels 9-13 units away, off the scene.
  it("every Mount Coffee label offset, scaled through its part, lands near that part", () => {
    const list = buildRenderList({ definition: hydropowerDefinition, state: hydropowerDefinition.initialState, profile: "HIGH" });
    const far = list.items.filter((item) => item.labelOffset).flatMap((item) => {
      const anchor = transformPoint(item.matrix, item.labelOffset!);
      const distance = Math.hypot(anchor[0] - item.center[0], anchor[1] - item.center[1], anchor[2] - item.center[2]);
      return distance > 3.5 ? [`${item.id}: ${distance.toFixed(2)}`] : [];
    });
    expect(far).toEqual([]);
  });
});

describe("label priority (A1 label cue, R4 visual)", () => {
  it("a part a check names outranks a nearer-centre part for a scarce budget, after highlighted parts", () => {
    const viewport = { width: 1000, height: 600 };
    const placed = placeSceneLabels([
      { id: "decor-near-centre", text: "Road", x: 500, y: 300, highlighted: false },
      { id: "runner", text: "Runner", x: 120, y: 520, highlighted: false, critical: true },
      { id: "inspected", text: "Generator", x: 880, y: 90, highlighted: true },
    ], viewport, 2);
    expect(placed.map((label) => label.id)).toEqual(["inspected", "runner"]);
  });
});
