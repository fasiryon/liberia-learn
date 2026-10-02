// R3 visual findings: scene labels are placed only on screen, never overlapping, nearest the frame centre first.
import { describe, expect, it } from "vitest";
import { labelBox, placeSceneLabels } from "@/lib/interactive-labs/v2/fidelity/labelLayout";

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
