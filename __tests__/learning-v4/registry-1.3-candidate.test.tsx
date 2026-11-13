// @vitest-environment jsdom
// teaching-blocks/1.3.0 CANDIDATE (for CoS contract review): DESIGN_CYCLE may name its MEASUREMENT_TABLE. 1.1.0 and
// 1.2.0 stay byte-identical; a 1.3.0 DESIGN_CYCLE without the link is a 1.2.0 one. Runtime: each tested design becomes a
// table row in the same ActivityScope, then a graph over designs. Memory only; nothing is scored or recorded.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { validateBlock_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";
import { TEACHING_BLOCK_REGISTRY_1_3, TEACHING_BLOCK_REGISTRY_VERSION_1_3, validateBlock_1_3, validateBlockReferences_1_3, type VisualBlock_1_3 } from "@/lib/learner-experience/teaching/registry-1.3";
import { registryForVersion } from "@/lib/learner-experience/teaching/registries";
import { ActivityScope } from "@/components/experience/blocks/stem/ActivityScope";
import { DesignCycleBlock } from "@/components/experience/blocks/stem/DesignCycleBlock";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import { GraphBuilderBlock } from "@/components/experience/blocks/stem/GraphBuilderBlock";
import type { DesignCycleData } from "@/lib/learner-experience/stem/designCycle";
import type { MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";
import type { GraphBuilderData } from "@/lib/learner-experience/stem/graphBuilder";

const TABLE: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "cover-results", title: "Cover designs compared", origin: "MEASURED_BY_LEARNER", originNote: "One row per design you test.",
  columns: [{ id: "layers", label: "Layers of plastic", unit: "", precision: 0, minimum: 1, maximum: 5 }, { id: "leak", label: "Water that got through", unit: "ml", precision: 0, minimum: 0, maximum: 250 },
    { id: "hold", label: "Time it stayed on", unit: "s", precision: 0, minimum: 0, maximum: 600 }],
  trials: [{ layers: null, leak: null, hold: null }, { layers: null, leak: null, hold: null }, { layers: null, leak: null, hold: null }], derived: ["MINIMUM"] };
const DESIGN: DesignCycleData = { type: "DESIGN_CYCLE", id: "cover", brief: "Design a cover that keeps rain out of a water bucket.",
  criteria: [{ id: "leak", description: "Keeps water out", measure: "Water that got through", unit: "ml", comparison: "AT_MOST", target: 20 },
    { id: "hold", description: "Stays on in wind", measure: "Seconds it stays on under the fan", unit: "s", comparison: "AT_LEAST", target: 30 }],
  constraints: ["Paper, plastic and string only."], safety: ["Wipe up spills at once."], testPlan: ["Pour one cup of water.", "Time it under the fan."], maxIterations: 3,
  measurement: { tableId: "cover-results", criterionColumns: [{ criterionId: "leak", columnId: "leak" }, { criterionId: "hold", columnId: "hold" }] } };
const GRAPH: GraphBuilderData = { type: "GRAPH_BUILDER", id: "cover-graph", prompt: "Graph water against layers.", sourceBlockId: "cover-results", allowedKinds: ["BAR"],
  axisRules: { xColumn: "layers", yColumn: "leak", zeroBaselineRequired: true } };
const { measurement: _link, ...DESIGN_1_2 } = DESIGN;

describe("1.3.0 contract candidate", () => {
  it("leaves the frozen 1.1.0 and 1.2.0 registry files and instruction 1.1.0 byte-identical to the school-day head", () => {
    // The bytes at the school-day head 309d3e9d, pinned by sha256 so the check needs no git history (shallow CI checkout).
    const FROZEN_AT_309D3E9D: Record<string, string> = {
      "lib/learner-experience/teaching/registry.ts": "1d772ecf457b6d8eac4200d59b435eede9d626a3c5401437e5da22dcd34e2e0f",
      "lib/learner-experience/teaching/registry-1.2.ts": "98ce9aac082dba78e278e594312d53d131e7e3982e99f82cb3d0eae760297020",
      "lib/learner-experience/teaching/instruction-1.1.ts": "3bdffea2862335d825a1fbdc210619e3a287834a955a7a4b15342fc1683f3936",
    };
    for (const [f, sha256] of Object.entries(FROZEN_AT_309D3E9D))
      expect(createHash("sha256").update(readFileSync(f)).digest("hex"), f).toBe(sha256);
  });
  it("a linked cycle is 1.3.0 only; 1.2.0 still refuses the new field", () => {
    expect(validateBlock_1_3(DESIGN, { subject: "ENGINEERING", grade: 4 }).problems).toEqual([]);
    expect(validateBlock_1_2(DESIGN, { subject: "ENGINEERING", grade: 4 }).problems[0]).toMatch(/^block_schema:DESIGN_CYCLE/);
  });
  it("without the link a 1.3.0 DESIGN_CYCLE is exactly a 1.2.0 one, including fit", () => {
    expect(validateBlock_1_3(DESIGN_1_2, { subject: "ENGINEERING", grade: 4 })).toEqual(validateBlock_1_2(DESIGN_1_2, { subject: "ENGINEERING", grade: 4 }));
    expect(validateBlock_1_3(DESIGN_1_2, { subject: "HISTORY", grade: 4 }).problems).toEqual(validateBlock_1_2(DESIGN_1_2, { subject: "HISTORY", grade: 4 }).problems);
    expect(validateBlock_1_3({ ...DESIGN, extra: 1 }).problems[0]).toMatch(/^block_schema:DESIGN_CYCLE/);
  });
  it("every criterion maps to one distinct column", () => {
    const one = { ...DESIGN, measurement: { tableId: "cover-results", criterionColumns: [{ criterionId: "leak", columnId: "leak" }] } };
    expect(validateBlock_1_3(one).problems.join()).toContain("measurement_criteria_unmapped");
    const reused = { ...DESIGN, measurement: { tableId: "cover-results", criterionColumns: [{ criterionId: "leak", columnId: "leak" }, { criterionId: "hold", columnId: "leak" }] } };
    expect(validateBlock_1_3(reused).problems.join()).toContain("measurement_column_reused");
  });
  it("same-package references: a learner table, matching units, a row per design, one cycle per table", () => {
    expect(validateBlockReferences_1_3([TABLE, DESIGN, GRAPH] as VisualBlock_1_3[])).toEqual([]);
    expect(validateBlockReferences_1_3([DESIGN] as VisualBlock_1_3[])).toEqual(["design_measurement_reference_invalid:cover"]);
    expect(validateBlockReferences_1_3([{ ...TABLE, origin: "ILLUSTRATIVE" }, DESIGN] as VisualBlock_1_3[])).toContain("design_measurement_table_not_learner:cover");
    expect(validateBlockReferences_1_3([{ ...TABLE, trials: TABLE.trials.slice(0, 2) }, DESIGN] as VisualBlock_1_3[])).toContain("design_measurement_too_few_trials:cover");
    expect(validateBlockReferences_1_3([{ ...TABLE, columns: TABLE.columns.map((c) => (c.id === "hold" ? { ...c, unit: "min" } : c)) }, DESIGN] as VisualBlock_1_3[])).toContain("design_measurement_unit_mismatch:cover:hold");
    expect(validateBlockReferences_1_3([TABLE, DESIGN, { ...DESIGN, id: "cover-two" }] as VisualBlock_1_3[])).toContain("design_measurement_table_shared:cover-results");
  });
  it("each criterion target lies inside its linked column's range (boundaries allowed)", () => {
    const withTarget = (id: string, target: number) => ({ ...DESIGN, criteria: DESIGN.criteria.map((c) => (c.id === id ? { ...c, target } : c)) });
    expect(validateBlockReferences_1_3([TABLE, withTarget("leak", 251)] as VisualBlock_1_3[])).toEqual(["design_measurement_target_out_of_range:cover:leak"]);
    expect(validateBlockReferences_1_3([TABLE, withTarget("hold", -1)] as VisualBlock_1_3[])).toEqual(["design_measurement_target_out_of_range:cover:hold"]);
    expect(validateBlockReferences_1_3([TABLE, withTarget("leak", 250)] as VisualBlock_1_3[])).toEqual([]);
    expect(validateBlockReferences_1_3([TABLE, withTarget("hold", 0)] as VisualBlock_1_3[])).toEqual([]);
    const { measurement: _m, ...unlinked } = withTarget("leak", 9999);
    expect(validateBlockReferences_1_3([TABLE, unlinked] as VisualBlock_1_3[])).toEqual([]);
    expect(validateBlockReferences_1_3([TABLE, { ...GRAPH, sourceBlockId: "cover" }] as VisualBlock_1_3[])).toContain("graph_reference_invalid:cover-graph");
  });
  it("resolves registries by sealed version: 1.3.0 here, 1.1.0 and 1.2.0 exactly as before", () => {
    expect(registryForVersion(TEACHING_BLOCK_REGISTRY_VERSION_1_3).entries).toBe(TEACHING_BLOCK_REGISTRY_1_3);
    expect(registryForVersion("teaching-blocks/1.2.0").version).toBe("teaching-blocks/1.2.0");
    expect(() => registryForVersion("teaching-blocks/9.9.9")).toThrow("teaching_block_registry_unknown");
  });
});

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); });
const mount = (node: React.ReactNode) => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root!.render(node)); return host; };
const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });
const button = (el: Element, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

function testDesign(el: HTMLElement, leak: string, hold: string) {
  const cycle = el.querySelector('[data-block-type="DESIGN_CYCLE"]')!;
  setValue(cycle.querySelector("textarea")!, "A plastic cover tied with string.");
  click(button(cycle, "Next: stay safe"));
  for (const box of cycle.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')) click(box);
  click(button(cycle, "Next: test"));
  const [a, b] = [...cycle.querySelectorAll('[data-stage-body="TEST"] input')] as HTMLInputElement[];
  setValue(a, leak); setValue(b, hold);
  click(button(cycle, "Next: check the results"));
}

describe("one continuous activity: design, measure, compare, graph", () => {
  it("each tested design becomes its table row; the table never asks for those values twice; a graph compares designs", () => {
    const el = mount(<ActivityScope><DesignCycleBlock block={DESIGN} /><MeasurementTableBlock block={TABLE} /><GraphBuilderBlock block={GRAPH} /></ActivityScope>);
    const table = el.querySelector('[data-block-type="MEASUREMENT_TABLE"]')!;
    expect(table.querySelector("[data-table-fed]")?.textContent).toContain("Water that got through and Time it stayed on");
    expect(table.querySelectorAll("input")).toHaveLength(3);
    expect(table.querySelectorAll("td[data-fed]")[0].textContent).toBe("Design 1 not tested yet");
    testDesign(el, "32", "18");
    expect(el.querySelector("[data-design-recorded]")?.textContent).toContain("row 1 of the measurement table");
    const fed = () => [...table.querySelectorAll("td[data-fed]")].map((td) => td.textContent);
    expect(fed()).toEqual(["32", "18", "Design 2 not tested yet", "Design 2 not tested yet", "Design 3 not tested yet", "Design 3 not tested yet"]);
    const cycle = el.querySelector('[data-block-type="DESIGN_CYCLE"]')!;
    setValue(cycle.querySelector('[data-stage-body="EVALUATE"] textarea')!, "Add a second layer.");
    click(button(cycle, "Test design 2"));
    testDesign(el, "12", "40");
    expect(fed().slice(0, 4)).toEqual(["32", "18", "12", "40"]);
    expect(table.querySelector('[data-derived-column="leak"] [data-derived="MINIMUM"]')?.textContent).toBe("Smallest: 12 ml");
    const layers = [...table.querySelectorAll("input")] as HTMLInputElement[];
    setValue(layers[0], "1"); setValue(layers[1], "2");
    const graph = el.querySelector('[data-block-type="GRAPH_BUILDER"]')!;
    const [x, y] = [...graph.querySelectorAll("select")];
    setValue(x, "layers"); setValue(y, "leak");
    expect(graph.querySelectorAll("rect.ll8-bar")).toHaveLength(2);
    expect(graph.querySelector("svg")?.getAttribute("aria-label")).toContain("Highest: 32 at 1. Lowest: 12 at 2.");
    expect(el.querySelector("[data-design-status]")?.getAttribute("data-design-status")).toBe("ALL_CRITERIA_MET");
    expect(el.textContent).not.toMatch(/\b(score|grade|failed)\b/i);
  });
  it("without the link (1.2.0 shape) the table stays fully learner-typed", () => {
    const el = mount(<ActivityScope><DesignCycleBlock block={DESIGN_1_2} /><MeasurementTableBlock block={TABLE} /></ActivityScope>);
    expect(el.querySelector("[data-table-fed]")).toBeNull();
    expect(el.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] input')).toHaveLength(9);
  });
  it("two cycles feeding one table are ignored rather than guessed", () => {
    const el = mount(<ActivityScope><DesignCycleBlock block={DESIGN} /><DesignCycleBlock block={{ ...DESIGN, id: "cover-two" }} /><MeasurementTableBlock block={TABLE} /></ActivityScope>);
    expect(el.querySelector("[data-table-fed]")).toBeNull();
  });
});
