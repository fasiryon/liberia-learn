// @vitest-environment jsdom
/**
 * T1-P6-FEED-01 REVISE (Atlas ATLAS-T1-P6-FEED-43008799-REVIEW.md, browser 4 RED at 97fafe34; CoS cycle 02): a DESIGN_CYCLE
 * linked to a MEASUREMENT_TABLE must check each TEST entry against the linked column's minimum, maximum and precision
 * BEFORE evaluation and before onDone. An invalid count (6 or 4.5 in a 0-5 whole-count column) keeps "Next: check the
 * results" disabled, keeps the design IN_PROGRESS, never reports done, and shows the column's message inline so the
 * learner can correct it. 0 stays valid; an untested design stays missing; earlier designs' evidence is kept.
 * Synthetic component fixtures only (jsdom mirror of Atlas's Chromium checks).
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ActivityScope } from "@/components/experience/blocks/stem/ActivityScope";
import { DesignCycleBlock } from "@/components/experience/blocks/stem/DesignCycleBlock";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import type { DesignCycleData } from "@/lib/learner-experience/stem/designCycle";
import type { MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";

const DESIGN: DesignCycleData = { type: "DESIGN_CYCLE", id: "switch", brief: "Build a switch.", criteria: [
  { id: "closed", description: "Light when closed", measure: "Successful closed trials", unit: "trials", comparison: "AT_LEAST", target: 4 },
  { id: "open", description: "Dark when open", measure: "Successful open trials", unit: "trials", comparison: "AT_LEAST", target: 5 }],
  constraints: ["Same kit."], safety: ["Teacher checks the circuit."], testPlan: ["Try five closures.", "Try five openings."], maxIterations: 2,
  measurement: { tableId: "switch-trials", criterionColumns: [{ criterionId: "closed", columnId: "closed-lit" }, { criterionId: "open", columnId: "open-dark" }] } };
const count = (id: string, label: string) => ({ id, label, unit: "trials", precision: 0, minimum: 0, maximum: 5 });
const TABLE: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "switch-trials", title: "Switch designs compared", origin: "MEASURED_BY_LEARNER",
  originNote: "Row 1 is Design 1. Row 2 is Design 2.", columns: [count("closed-lit", "Closed-switch successes"), count("open-dark", "Open-switch successes")],
  trials: [{ "closed-lit": null, "open-dark": null }, { "closed-lit": null, "open-dark": null }], derived: [] };

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); vi.unstubAllGlobals(); });
const mount = (node: React.ReactNode) => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root!.render(node)); return host;
};
const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });
const cycleOf = (el: HTMLElement) => el.querySelector('[data-block-type="DESIGN_CYCLE"]') as HTMLElement;
const button = (el: Element, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const testInputs = (el: HTMLElement) => [...cycleOf(el).querySelectorAll('[data-stage-body="TEST"] input')] as HTMLInputElement[];
const checkButton = (el: HTMLElement) => button(cycleOf(el), "Next: check the results");
const fed = (el: HTMLElement) => [...el.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] td[data-fed]')].map((td) => td.textContent);

/** Plan, safety, open TEST, then type the two results (does not press "check"). */
function enterResults(el: HTMLElement, closed: string, open: string) {
  const cycle = cycleOf(el);
  const plan = cycle.querySelector('[data-stage-body="PLAN"] textarea') as HTMLTextAreaElement;
  if (!plan.value) setValue(plan, "Two contacts.");
  click(button(cycle, "Next: stay safe"));
  for (const box of cycle.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')) click(box);
  click(button(cycle, "Next: test"));
  const [a, b] = testInputs(el);
  setValue(a, closed); setValue(b, open);
}
const linked = (onDone?: (id: string, done: boolean) => void) =>
  mount(<ActivityScope><DesignCycleBlock block={DESIGN} onDone={onDone} /><MeasurementTableBlock block={TABLE} /></ActivityScope>);

describe("a linked TEST entry must obey its table column before evaluation", () => {
  it.each(["6", "4.5"])("an entry of %s keeps 'check' disabled, the design IN_PROGRESS and done false", (bad) => {
    const onDone = vi.fn();
    const el = linked(onDone);
    enterResults(el, bad, "5");
    expect(checkButton(el).disabled).toBe(true);
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("IN_PROGRESS");
    expect(onDone).not.toHaveBeenCalledWith("switch", true);
    expect(fed(el)).toEqual(["Design 1 not tested yet", "Design 1 not tested yet", "Design 2 not tested yet", "Design 2 not tested yet"]);
  });
  it("the column's own message is shown inline, and correcting the entry recovers", () => {
    const onDone = vi.fn();
    const el = linked(onDone);
    enterResults(el, "6", "5");
    const [closed] = testInputs(el);
    expect(closed.getAttribute("aria-invalid")).toBe("true");
    expect(cycleOf(el).querySelector('[data-stage-body="TEST"]')!.textContent).toMatch(/from 0 trials to 5 trials/);
    setValue(closed, "4.5");
    expect(cycleOf(el).querySelector('[data-stage-body="TEST"]')!.textContent).toContain("Round to a whole number.");
    expect(checkButton(el).disabled).toBe(true);
    setValue(closed, "5");
    expect(closed.hasAttribute("aria-invalid")).toBe(false);
    expect(checkButton(el).disabled).toBe(false);
    click(checkButton(el));
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("ALL_CRITERIA_MET");
    expect(onDone).toHaveBeenLastCalledWith("switch", true);
    expect(fed(el).slice(0, 2)).toEqual(["5", "5"]);
  });
  it("0 is a valid count (it is checked, not treated as missing)", () => {
    const el = linked();
    enterResults(el, "0", "5");
    expect(checkButton(el).disabled).toBe(false);
    click(checkButton(el));
    expect(cycleOf(el).getAttribute("data-design-status")).toBe("IN_PROGRESS");
    expect(fed(el).slice(0, 2)).toEqual(["0", "5"]);
  });
  it("an invalid second design keeps design 1's evidence and leaves design 2 untested", () => {
    const el = linked();
    enterResults(el, "4", "5");
    click(checkButton(el));
    setValue(cycleOf(el).querySelector('[data-stage-body="EVALUATE"] textarea') as HTMLTextAreaElement, "Widen one contact.");
    click(cycleOf(el).querySelector("[data-design-next]")!);
    enterResults(el, "6", "5");
    expect(checkButton(el).disabled).toBe(true);
    expect(fed(el)).toEqual(["4", "5", "Design 2 not tested yet", "Design 2 not tested yet"]);
    expect(cycleOf(el).textContent).toContain("Earlier designs (1)");
  });
});

describe("unchanged without a linked column", () => {
  it("an unlinked cycle still accepts any measured number (no column to obey)", () => {
    const { measurement: _m, ...unlinked } = DESIGN;
    const el = mount(<DesignCycleBlock block={unlinked} />);
    enterResults(el, "6", "5");
    expect(checkButton(el).disabled).toBe(false);
  });
});
