// @vitest-environment jsdom
/**
 * P6-COMPARE-01 (T2 0b00bf5c, P6-RENDERER-DIAGNOSIS-20261027.md): a DESIGN_CYCLE must let the learner test another
 * design while iteration capacity remains, even after a design meets every criterion, so two designs can be compared
 * (P6 Engineering: two tested designs, measured rows, a graph and a comparison). Completion (onDone) and the overall
 * cycle status keep their meaning; maxIterations stays a maximum, never a minimum; every design still passes the
 * safety gate; feedback describes the design just tested, never an earlier one; linked table rows stay with their
 * design; nothing is stored or sent.
 * The first case is T2's pinned case (test sha256 d84c343a...), unchanged except the import alias (@p6 -> @).
 * Synthetic component fixtures only, not a generated lesson, academic acceptance or browser result.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DesignCycleBlock } from "@/components/experience/blocks/stem/DesignCycleBlock";
import { ActivityScope } from "@/components/experience/blocks/stem/ActivityScope";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import { GraphBuilderBlock } from "@/components/experience/blocks/stem/GraphBuilderBlock";
import type { DesignCycleData } from "@/lib/learner-experience/stem/designCycle";
import type { MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";
import type { GraphBuilderData } from "@/lib/learner-experience/stem/graphBuilder";

// T2's pinned case (P6-COMPARE-01), body unchanged.
// Synthetic unit fixture, not a generated lesson, academic acceptance or browser result.
it("allows a second tested design after the first meets all criteria while capacity remains", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const block = { type: "DESIGN_CYCLE" as const, id: "two-switches", brief: "Compare two switch designs.",
    criteria: [{ id: "closed", description: "Light when closed", measure: "Successful closed trials", unit: "trials", comparison: "AT_LEAST" as const, target: 4 },
      { id: "open", description: "Dark when open", measure: "Successful open trials", unit: "trials", comparison: "AT_LEAST" as const, target: 5 }],
    constraints: ["Keep the same battery, bulb and wires."], safety: ["Teacher checks the low-voltage circuit."], testPlan: ["Try five closures.", "Try five openings."], maxIterations: 2 };
  const change = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const click = async (label: string) => {
    const button = [...host.querySelectorAll("button")].find(b => b.textContent?.trim().startsWith(label));
    expect(button, label).toBeDefined(); await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<ActivityScope><DesignCycleBlock block={block} /></ActivityScope>));
    await change(host.querySelector("textarea")!, "Two metal contacts in a teacher-checked series circuit.");
    await click("Next: stay safe");
    await act(async () => host.querySelector<HTMLInputElement>('[data-stage-body="SAFETY"] input')!.click());
    await click("Next: test");
    const fields = [...host.querySelectorAll<HTMLInputElement>('[data-stage-body="TEST"] input')];
    await change(fields[0], "4"); await change(fields[1], "5"); await click("Next: check the results");
    expect(host.querySelector('[data-design-status="ALL_CRITERIA_MET"]')).not.toBeNull();
    const improvement = host.querySelector<HTMLTextAreaElement>('[data-stage-body="EVALUATE"] textarea');
    expect(improvement, "A successful first design must still permit a data-based comparison/refinement").not.toBeNull();
    await change(improvement!, "Widen one contact to try to improve four successes to five.");
    const next = host.querySelector<HTMLButtonElement>("[data-design-next]");
    expect(next).not.toBeNull(); expect(next!.disabled).toBe(false); await act(async () => next!.click());
    expect(host.querySelector('[data-design-iteration="2"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

// ---- T1 cases ----
const SWITCH: DesignCycleData = { type: "DESIGN_CYCLE", id: "switch", brief: "Build a switch that controls a bulb.",
  criteria: [{ id: "closed", description: "Light when closed", measure: "Successful closed trials", unit: "trials", comparison: "AT_LEAST", target: 4 },
    { id: "open", description: "Dark when open", measure: "Successful open trials", unit: "trials", comparison: "AT_LEAST", target: 5 }],
  constraints: ["Keep the same battery, bulb and wires."], safety: ["Teacher checks the low-voltage circuit.", "Hands dry before touching the circuit."],
  testPlan: ["Try five closures.", "Try five openings."], maxIterations: 2,
  measurement: { tableId: "switch-trials", criterionColumns: [{ criterionId: "closed", columnId: "closed" }, { criterionId: "open", columnId: "open" }] } };
const TABLE: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "switch-trials", title: "Switch designs compared", origin: "MEASURED_BY_LEARNER", originNote: "One row per design you test.",
  columns: [{ id: "width", label: "Contact width", unit: "mm", precision: 0, minimum: 1, maximum: 50 }, { id: "closed", label: "Closed trials lit", unit: "trials", precision: 0, minimum: 0, maximum: 5 },
    { id: "open", label: "Open trials dark", unit: "trials", precision: 0, minimum: 0, maximum: 5 }],
  trials: [{ width: null, closed: null, open: null }, { width: null, closed: null, open: null }], derived: [] };
const GRAPH: GraphBuilderData = { type: "GRAPH_BUILDER", id: "switch-graph", prompt: "Graph lit trials against contact width.", sourceBlockId: "switch-trials", allowedKinds: ["BAR"],
  axisRules: { xColumn: "width", yColumn: "closed", zeroBaselineRequired: true } };

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = (node: React.ReactNode) => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root!.render(node)); return host;
};
const rerender = (node: React.ReactNode) => act(() => root!.render(node));
const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });
const cycleOf = (el: HTMLElement) => el.querySelector('[data-block-type="DESIGN_CYCLE"]') as HTMLElement;
const button = (el: Element, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
const stageButton = (el: Element, stage: string) => el.querySelector(`[data-stage="${stage}"]`) as HTMLButtonElement;
const feedback = (el: HTMLElement) => cycleOf(el).querySelector("[data-design-feedback]")?.textContent ?? "";
const improvementBox = (el: HTMLElement) => cycleOf(el).querySelector('[data-stage-body="EVALUATE"] textarea') as HTMLTextAreaElement | null;
const nextButton = (el: HTMLElement) => cycleOf(el).querySelector("[data-design-next]") as HTMLButtonElement | null;

/** Plan (kept from the last design), tick every safety rule, enter the results, open Check and improve. */
function testDesign(el: HTMLElement, closed: string, open: string) {
  const cycle = cycleOf(el);
  const plan = cycle.querySelector('[data-stage-body="PLAN"] textarea') as HTMLTextAreaElement;
  if (!plan.value) setValue(plan, "Two metal contacts in a series circuit.");
  click(button(cycle, "Next: stay safe")!);
  for (const box of cycle.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')) click(box);
  click(button(cycle, "Next: test")!);
  const [a, b] = [...cycle.querySelectorAll('[data-stage-body="TEST"] input')] as HTMLInputElement[];
  setValue(a, closed); setValue(b, open);
  click(button(cycle, "Next: check the results")!);
}

describe("a successful first design can still be compared with a second", () => {
  it("success first: design 1 feedback offers a second design; design 2 is judged on its own results", () => {
    const onDone = vi.fn();
    const el = mount(<ActivityScope><DesignCycleBlock block={SWITCH} onDone={onDone} /></ActivityScope>);
    testDesign(el, "4", "5");
    expect(feedback(el)).toMatch(/^Design 1 meets every criterion\./);
    expect(feedback(el)).toMatch(/design 2/i);
    expect(onDone).toHaveBeenLastCalledWith("switch", true);
    expect(nextButton(el)!.disabled).toBe(true);
    setValue(improvementBox(el)!, "Widen one contact.");
    click(nextButton(el)!);
    expect(cycleOf(el).getAttribute("data-design-iteration")).toBe("2");
    testDesign(el, "3", "5");
    // Design 2 does not meet the closed criterion: it must not be described as successful because design 1 was.
    expect(feedback(el)).not.toMatch(/Design 2 meets every criterion/);
    expect(feedback(el)).toContain("Not yet met: Light when closed");
    expect(feedback(el)).toContain("Design 1 met every criterion");
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("ALL_CRITERIA_MET");
    expect(onDone).toHaveBeenLastCalledWith("switch", true);
    expect(el.textContent).not.toMatch(/\b(score|grade|failed|fail)\b/i);
  });
  it("a change told to the teacher (oral refinement) also opens the second design", () => {
    const el = mount(<DesignCycleBlock block={SWITCH} />);
    testDesign(el, "4", "5");
    click(cycleOf(el).querySelector('[data-stage-body="EVALUATE"] input[type=checkbox]')!);
    expect(nextButton(el)!.disabled).toBe(false);
    click(nextButton(el)!);
    expect(cycleOf(el).getAttribute("data-design-iteration")).toBe("2");
  });
  it("failure first, then success, still works and the last design reached closes the cycle", () => {
    const el = mount(<DesignCycleBlock block={SWITCH} />);
    testDesign(el, "2", "5");
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("IN_PROGRESS");
    expect(feedback(el)).toContain("test design 2");
    setValue(improvementBox(el)!, "Press the contacts closer together.");
    click(nextButton(el)!);
    testDesign(el, "5", "5");
    expect(feedback(el)).toMatch(/^Design 2 meets every criterion/);
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("ALL_CRITERIA_MET");
    // maxIterations is 2: no third design, and nothing more to change.
    expect(nextButton(el)).toBeNull();
    expect(improvementBox(el)).toBeNull();
  });
});

describe("bounds and gates are kept", () => {
  it("maxIterations stays a maximum after an early success", () => {
    const el = mount(<DesignCycleBlock block={SWITCH} />);
    testDesign(el, "4", "5");
    setValue(improvementBox(el)!, "Widen one contact.");
    click(nextButton(el)!);
    testDesign(el, "5", "5");
    expect(cycleOf(el).getAttribute("data-design-iteration")).toBe("2");
    expect(nextButton(el)).toBeNull();
    expect(button(cycleOf(el), "Test design 3")).toBeUndefined();
  });
  it("maxIterations is not a minimum: one successful design is complete", () => {
    const onDone = vi.fn();
    const el = mount(<DesignCycleBlock block={SWITCH} onDone={onDone} />);
    testDesign(el, "4", "5");
    expect(onDone).toHaveBeenLastCalledWith("switch", true);
  });
  it("the second design repeats the safety gate before any test", () => {
    const el = mount(<DesignCycleBlock block={SWITCH} />);
    testDesign(el, "4", "5");
    setValue(improvementBox(el)!, "Widen one contact.");
    click(nextButton(el)!);
    const cycle = cycleOf(el);
    expect(stageButton(cycle, "TEST").disabled).toBe(true);
    click(button(cycle, "Next: stay safe")!);
    const [first] = [...cycle.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')];
    click(first);
    expect(button(cycle, "Next: test")!.disabled).toBe(true);
  });
  it("an incomplete second design cannot be checked, and its table row stays empty", () => {
    const el = mount(<ActivityScope><DesignCycleBlock block={SWITCH} /><MeasurementTableBlock block={TABLE} /></ActivityScope>);
    testDesign(el, "4", "5");
    setValue(improvementBox(el)!, "Widen one contact.");
    click(nextButton(el)!);
    const cycle = cycleOf(el);
    click(button(cycle, "Next: stay safe")!);
    for (const box of cycle.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')) click(box);
    click(button(cycle, "Next: test")!);
    setValue(cycle.querySelector('[data-stage-body="TEST"] input')!, "5");
    expect(button(cycle, "Next: check the results")!.disabled).toBe(true);
    const fed = [...el.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] td[data-fed]')].map((td) => td.textContent);
    expect(fed).toEqual(["4", "5", "Design 2 not tested yet", "Design 2 not tested yet"]);
  });
});

describe("linked evidence stays with its design", () => {
  it("design 1 and design 2 fill their own table rows, the graph compares them, and nothing is invented or stored", () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const el = mount(<ActivityScope><DesignCycleBlock block={SWITCH} /><MeasurementTableBlock block={TABLE} /><GraphBuilderBlock block={GRAPH} /></ActivityScope>);
    const table = el.querySelector('[data-block-type="MEASUREMENT_TABLE"]')!;
    const fed = () => [...table.querySelectorAll("td[data-fed]")].map((td) => td.textContent);
    expect(fed()).toEqual(["Design 1 not tested yet", "Design 1 not tested yet", "Design 2 not tested yet", "Design 2 not tested yet"]);
    testDesign(el, "4", "5");
    expect(fed()).toEqual(["4", "5", "Design 2 not tested yet", "Design 2 not tested yet"]);
    setValue(improvementBox(el)!, "Widen one contact.");
    click(nextButton(el)!);
    // Starting design 2 changes nothing in row 1 and invents nothing in row 2.
    expect(fed()).toEqual(["4", "5", "Design 2 not tested yet", "Design 2 not tested yet"]);
    testDesign(el, "5", "5");
    expect(fed()).toEqual(["4", "5", "5", "5"]);
    const widths = [...table.querySelectorAll("input")] as HTMLInputElement[];
    expect(widths).toHaveLength(2);
    setValue(widths[0], "3"); setValue(widths[1], "6");
    const graph = el.querySelector('[data-block-type="GRAPH_BUILDER"]')!;
    const [x, y] = [...graph.querySelectorAll("select")];
    setValue(x, "width"); setValue(y, "closed");
    expect(graph.querySelectorAll("rect.ll8-bar")).toHaveLength(2);
    expect(graph.querySelector("svg")?.getAttribute("aria-label")).toContain("Highest: 5 at 6. Lowest: 4 at 3.");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
  it("reset: a new activity scope (another scene or lesson revision) starts from design 1 with an empty table", () => {
    const view = (key: string) => <ActivityScope key={key}><DesignCycleBlock block={SWITCH} /><MeasurementTableBlock block={TABLE} /></ActivityScope>;
    const el = mount(view("p6@1:design"));
    testDesign(el, "4", "5");
    setValue(improvementBox(el)!, "Widen one contact.");
    click(nextButton(el)!);
    expect(cycleOf(el).getAttribute("data-design-iteration")).toBe("2");
    rerender(view("p6@2:design"));
    expect(cycleOf(el).getAttribute("data-design-iteration")).toBe("1");
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("IN_PROGRESS");
    expect([...el.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] td[data-fed]')].map((td) => td.textContent))
      .toEqual(["Design 1 not tested yet", "Design 1 not tested yet", "Design 2 not tested yet", "Design 2 not tested yet"]);
  });
});
