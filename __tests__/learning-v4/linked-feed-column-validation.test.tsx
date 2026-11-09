// @vitest-environment jsdom
/**
 * Atlas linked-feed REDs (153d14eb, artifacts/atlas-design-cycle-review/p6-input.test.ts; checkpoint
 * ATLAS-INDEPENDENT-P6-SEC-R08-CHECKPOINT-20261027.md): a value a linked DESIGN_CYCLE feeds into a MEASUREMENT_TABLE
 * column must pass the same column rules as a typed entry (range and precision). A design may legitimately record a
 * number the cycle accepts (for example 6), but a 0-5 whole-count column must not accept it as an observation: the
 * cell is shown as a count to check, never as "not tested yet" (it was tested) and never as a usable value, so it
 * reaches no derived value and no graph. Valid fed values are unchanged. No frozen contract change.
 * Synthetic component fixtures only.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cellValue, columnValues, type MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";
import { ActivityScope, usePublishSnapshot } from "@/components/experience/blocks/stem/ActivityScope";
import { DesignCycleBlock } from "@/components/experience/blocks/stem/DesignCycleBlock";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import { GraphBuilderBlock } from "@/components/experience/blocks/stem/GraphBuilderBlock";
import type { DesignCycleData } from "@/lib/learner-experience/stem/designCycle";
import type { GraphBuilderData } from "@/lib/learner-experience/stem/graphBuilder";

const count = { id: "lit-successes", label: "Closed-switch successes", unit: "trials", precision: 0, minimum: 0, maximum: 5 };
const blank: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "switch-trials", title: "Switch designs compared", origin: "MEASURED_BY_LEARNER",
  originNote: "Row 1 is Design 1. Row 2 is Design 2.", columns: [count], trials: [{ "lit-successes": null }, { "lit-successes": null }], derived: ["MAXIMUM"] };

describe("cellValue: a fed value obeys the column like a typed entry", () => {
  // Atlas's two REDs, same inputs and expectation.
  it.each([6, 4.5])("RED: linked design feed must reject invalid observation %s just like manual entry", (value) => {
    const feed = { columns: ["lit-successes"], rows: [{ "lit-successes": value }] };
    expect(cellValue(blank, 0, count, {}, feed)).toBeNull();
  });
  it.each([-1, 5.000001])("also rejects %s (below the minimum, or finer than the column's precision)", (value) => {
    expect(cellValue(blank, 0, count, {}, { columns: ["lit-successes"], rows: [{ "lit-successes": value }] })).toBeNull();
  });
  it.each([0, 4, 5])("accepts the valid count %s", (value) => {
    expect(cellValue(blank, 0, count, {}, { columns: ["lit-successes"], rows: [{ "lit-successes": value }] })).toBe(value);
  });
  it("a column with one decimal place accepts 4.5 from the feed", () => {
    const tenths = { ...count, precision: 1 };
    expect(cellValue({ ...blank, columns: [tenths] }, 0, tenths, {}, { columns: ["lit-successes"], rows: [{ "lit-successes": 4.5 }] })).toBe(4.5);
  });
  it("an invalid fed value is not counted in the column's values", () => {
    expect(columnValues(blank, count, {}, { columns: ["lit-successes"], rows: [{ "lit-successes": 6 }, { "lit-successes": 4 }] })).toEqual([4]);
  });
});

const DESIGN: DesignCycleData = { type: "DESIGN_CYCLE", id: "switch", brief: "Build a switch.", criteria: [
  { id: "closed", description: "Light when closed", measure: "Successful closed trials", unit: "trials", comparison: "AT_LEAST", target: 4 }],
  constraints: ["Same kit."], safety: ["Teacher checks the circuit."], testPlan: ["Try five closures.", "Count the lit trials."], maxIterations: 2,
  measurement: { tableId: "switch-trials", criterionColumns: [{ criterionId: "closed", columnId: "lit-successes" }] } };
const GRAPH: GraphBuilderData = { type: "GRAPH_BUILDER", id: "g", prompt: "Graph it.", sourceBlockId: "switch-trials", allowedKinds: ["BAR"],
  axisRules: { xColumn: "width", yColumn: "lit-successes", zeroBaselineRequired: true } };
const TABLE_WITH_X: MeasurementTableData = { ...blank, columns: [{ id: "width", label: "Contact width", unit: "mm", precision: 0, minimum: 1, maximum: 50 }, count],
  trials: [{ width: null, "lit-successes": null }, { width: null, "lit-successes": null }] };

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); vi.unstubAllGlobals(); });
const mount = (node: React.ReactNode) => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root!.render(node)); return host;
};
const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });
const button = (el: Element, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
function testDesign(el: HTMLElement, closed: string) {
  const cycle = el.querySelector('[data-block-type="DESIGN_CYCLE"]')!;
  const plan = cycle.querySelector('[data-stage-body="PLAN"] textarea') as HTMLTextAreaElement;
  if (!plan.value) setValue(plan, "Two contacts.");
  click(button(cycle, "Next: stay safe"));
  for (const box of cycle.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')) click(box);
  click(button(cycle, "Next: test"));
  setValue(cycle.querySelector('[data-stage-body="TEST"] input') as HTMLInputElement, closed);
  click(button(cycle, "Next: check the results"));
}

/**
 * TEST-ONLY feed publisher. Since T1-P6-FEED-01 the DESIGN_CYCLE itself refuses an entry that breaks its linked column,
 * so the UI can no longer produce an out-of-range feed; the table-side check is kept as defence in depth and is driven
 * here by a synthetic DESIGN_FEED in the same scope.
 */
function FeedPublisher({ rows }: { rows: ReadonlyArray<Record<string, number | null>> }) {
  usePublishSnapshot("synthetic-cycle", { kind: "DESIGN_FEED", tableId: "switch-trials", columns: ["lit-successes"], rows });
  return null;
}

describe("the table shows an out-of-range fed count as one to check, and nothing downstream uses it (defence in depth)", () => {
  it("a fed result of 6 in a 0-5 column is flagged, not shown as a value or as untested", () => {
    const el = mount(<ActivityScope><FeedPublisher rows={[{ "lit-successes": 6 }, { "lit-successes": null }]} /><MeasurementTableBlock block={blank} /></ActivityScope>);
    const cell = el.querySelector('[data-block-type="MEASUREMENT_TABLE"] td[data-fed]')!;
    expect(cell.textContent).not.toContain("not tested yet");
    expect(cell.getAttribute("data-fed-invalid")).toBe("");
    expect(cell.textContent).toContain("6");
    expect(cell.textContent).toMatch(/from 0 trials to 5 trials/);
    // The derived maximum ignores it: there is no usable value yet.
    expect(el.querySelector('[data-derived="MAXIMUM"]')).toBeNull();
  });
  it("the graph gets no bar from an out-of-range count, and a valid second design still plots", () => {
    const el = mount(<ActivityScope><FeedPublisher rows={[{ "lit-successes": 6 }, { "lit-successes": 4 }]} /><MeasurementTableBlock block={TABLE_WITH_X} /><GraphBuilderBlock block={GRAPH} /></ActivityScope>);
    const widths = [...el.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] input')] as HTMLInputElement[];
    setValue(widths[0], "3"); setValue(widths[1], "6");
    const graph = el.querySelector('[data-block-type="GRAPH_BUILDER"]')!;
    const [x, y] = [...graph.querySelectorAll("select")];
    setValue(x, "width"); setValue(y, "lit-successes");
    // One usable point (design 2) is not enough for a graph; design 1's 6 is never drawn.
    expect(graph.querySelectorAll("rect.ll8-bar")).toHaveLength(0);
    expect(graph.querySelector("[data-graph-needs-points]")).not.toBeNull();
  });
  it("a valid fed count is shown exactly as before", () => {
    const el = mount(<ActivityScope><DesignCycleBlock block={DESIGN} /><MeasurementTableBlock block={blank} /></ActivityScope>);
    testDesign(el, "4");
    const cell = el.querySelector('[data-block-type="MEASUREMENT_TABLE"] td[data-fed]')!;
    expect(cell.textContent).toBe("4");
    expect(cell.hasAttribute("data-fed-invalid")).toBe(false);
  });
});
