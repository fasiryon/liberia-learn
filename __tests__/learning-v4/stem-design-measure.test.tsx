// @vitest-environment jsdom
// teaching-blocks/1.2.0 DESIGN_CYCLE and MEASUREMENT_TABLE renderers (Grade 4 P6 Engineering needs both). Fixtures are
// component fixtures validated by the canonical registry schemas; they are not lesson content.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { validateBlock_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";
import { deriveColumn, readEntry, tableComplete, validateMeasurementTable, type MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";
import { cycleFeedback, cycleStatus, emptyIteration, evaluate, judge, stageReady, trend, validateDesignCycle, type DesignCycleData } from "@/lib/learner-experience/stem/designCycle";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import { DesignCycleBlock } from "@/components/experience/blocks/stem/DesignCycleBlock";

const TABLE: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "cover-test", title: "Water kept out by each cover", origin: "MEASURED_BY_LEARNER", originNote: "Measure with the class cup.",
  columns: [{ id: "ml", label: "Water that got through", unit: "ml", precision: 0, minimum: 0, maximum: 250 }, { id: "secs", label: "Time to soak", unit: "s", precision: 1, minimum: 0, maximum: 600 }],
  trials: [{ ml: null, secs: null }, { ml: null, secs: null }, { ml: null, secs: null }], derived: ["MEAN", "RANGE"] };
const ILLUSTRATIVE: MeasurementTableData = { ...TABLE, id: "sample", origin: "ILLUSTRATIVE", originNote: "Sample numbers to practise reading a table.",
  trials: [{ ml: 40, secs: 12.5 }, { ml: 60, secs: null }] };
const DESIGN: DesignCycleData = { type: "DESIGN_CYCLE", id: "cover", brief: "Design a cover that keeps rain out of a water bucket.",
  criteria: [{ id: "leak", description: "Keeps water out", measure: "Water that got through", unit: "ml", comparison: "AT_MOST", target: 20 },
    { id: "hold", description: "Stays on in wind", measure: "Seconds it stays on under the fan", unit: "s", comparison: "AT_LEAST", target: 30 }],
  constraints: ["Use only paper, plastic and string.", "It must fit the class bucket."], safety: ["Wipe up spilled water at once.", "Keep the fan cable away from water."],
  testPlan: ["Pour one cup of water over the cover.", "Measure the water in the bucket.", "Run the fan and time how long the cover stays on."], maxIterations: 3 };

describe("fixtures are valid under the canonical 1.2.0 registry", () => {
  it("validates both blocks for Grade 4 Engineering", () => {
    for (const b of [TABLE, ILLUSTRATIVE, DESIGN]) expect(validateBlock_1_2(b, { subject: "ENGINEERING", grade: 4 }).problems).toEqual([]);
  });
  it("the renderers refuse what the registry refuses", () => {
    expect(() => validateMeasurementTable({ ...TABLE, trials: [{ ml: 5, secs: null }] })).toThrow("prefilled_learner_measurement_forbidden");
    expect(() => validateMeasurementTable({ ...TABLE, extra: 1 })).toThrow("measurement_table_invalid");
    expect(() => validateDesignCycle({ ...DESIGN, maxIterations: 9 })).toThrow("design_cycle_invalid");
    expect(() => validateDesignCycle({ ...DESIGN, criteria: [DESIGN.criteria[0], DESIGN.criteria[0]] })).toThrow("duplicate_criterion");
  });
});

describe("MEASUREMENT_TABLE model", () => {
  const ml = TABLE.columns[0], secs = TABLE.columns[1];
  it("reads entries against the column's range and precision", () => {
    expect(readEntry(" 35 ", ml)).toEqual({ ok: true, value: 35 });
    expect(readEntry("", ml)).toMatchObject({ ok: false, problem: "EMPTY" });
    expect(readEntry("3,5", ml)).toMatchObject({ ok: false, problem: "NOT_A_NUMBER" });
    expect(readEntry("1e3", ml)).toMatchObject({ ok: false, problem: "NOT_A_NUMBER" });
    expect(readEntry("300", ml)).toMatchObject({ ok: false, problem: "OUT_OF_RANGE", message: "Check this one: it should be from 0 ml to 250 ml." });
    expect(readEntry("12.5", ml)).toMatchObject({ ok: false, problem: "TOO_PRECISE", message: "Round to a whole number." });
    expect(readEntry("12.5", secs)).toEqual({ ok: true, value: 12.5 });
  });
  it("derives only what the block asks for, the mean one place finer than the readings", () => {
    expect(deriveColumn([10, 11, 13], ml, ["MEAN", "RANGE"])).toEqual([{ kind: "MEAN", value: 11.3, text: "11.3 ml" }, { kind: "RANGE", value: 3, text: "3 ml" }]);
    expect(deriveColumn([], ml, ["MEAN"])).toEqual([]);
  });
  it("is complete only when every editable cell is valid; given illustrative cells are not editable", () => {
    expect(tableComplete(TABLE, {})).toBe(false);
    const all = { "0:ml": "10", "0:secs": "4", "1:ml": "11", "1:secs": "4.5", "2:ml": "13", "2:secs": "5" };
    expect(tableComplete(TABLE, all)).toBe(true);
    expect(tableComplete(TABLE, { ...all, "2:ml": "999" })).toBe(false);
    expect(tableComplete(ILLUSTRATIVE, {})).toBe(false);
    expect(tableComplete(ILLUSTRATIVE, { "1:secs": "20" })).toBe(true);
  });
});

describe("DESIGN_CYCLE model", () => {
  const [leak, hold] = DESIGN.criteria;
  it("judges each result against its criterion and states the gap", () => {
    expect(judge(leak, "15")).toMatchObject({ met: true, gap: 0, message: "Meets it: 15 ml (needed at most 20 ml)." });
    expect(judge(leak, "32")).toMatchObject({ met: false, gap: 12, message: "Not yet: 32 ml, needed at most 20 ml. 12 ml over." });
    expect(judge(hold, "18")).toMatchObject({ met: false, gap: 12, message: "Not yet: 18 s, needed at least 30 s. 12 s short." });
    expect(judge(hold, "lots")).toBeNull();
  });
  it("opens stages in order: safety needs a plan, testing needs every safety rule", () => {
    const it0 = emptyIteration(DESIGN);
    expect(stageReady(DESIGN, it0, "SAFETY")).toBe(false);
    expect(stageReady(DESIGN, { ...it0, shownToTeacher: true }, "SAFETY")).toBe(true);
    expect(stageReady(DESIGN, { ...it0, plan: "Plastic sheet tied with string", safety: [true, false] }, "TEST")).toBe(false);
    const tested = { ...it0, plan: "Plastic sheet", safety: [true, true], results: { leak: "32" } };
    expect(stageReady(DESIGN, tested, "EVALUATE")).toBe(false);
    expect(stageReady(DESIGN, { ...tested, results: { leak: "32", hold: "18" } }, "EVALUATE")).toBe(true);
  });
  it("tracks progress across designs and ends at all-met or the last try, never with a grade", () => {
    const base = { ...emptyIteration(DESIGN), plan: "p", safety: [true, true] };
    const first = evaluate(DESIGN, { ...base, results: { leak: "32", hold: "18" } })!, second = evaluate(DESIGN, { ...base, results: { leak: "25", hold: "40" } })!;
    expect(trend(second[0], first[0])).toBe("CLOSER");
    expect(trend(second[1], first[1])).toBe("CLOSER");
    expect(cycleStatus(DESIGN, [first, second])).toBe("IN_PROGRESS");
    expect(cycleFeedback(DESIGN, second, "IN_PROGRESS", 2)).toBe("Not yet met: Keeps water out. Decide one change to try, write why, then test design 3.");
    expect(cycleStatus(DESIGN, [first, second, second])).toBe("OUT_OF_ITERATIONS");
    const met = evaluate(DESIGN, { ...base, results: { leak: "10", hold: "45" } })!;
    expect(cycleStatus(DESIGN, [first, met])).toBe("ALL_CRITERIA_MET");
    expect(cycleFeedback(DESIGN, met, "ALL_CRITERIA_MET", 2)).toMatch(/^Design 2 meets every criterion/);
    expect(cycleFeedback(DESIGN, second, "OUT_OF_ITERATIONS", 3)).not.toMatch(/fail|score|grade/i);
  });
});

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); });
const mount = (node: React.ReactNode) => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root!.render(node)); return host; };
const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true }));
});
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });
const button = (el: HTMLElement, text: string | RegExp) => [...el.querySelectorAll("button")].find((b) => (typeof text === "string" ? b.textContent?.includes(text) : text.test(b.textContent ?? "")))!;

describe("MeasurementTableBlock", () => {
  it("states the origin, labels every input with trial, column and unit, and stores nothing", () => {
    const html = renderToStaticMarkup(<MeasurementTableBlock block={TABLE} />);
    expect(html).toContain("Your own measurements. Measure with the class cup.");
    expect(html).toContain('aria-label="Trial 2, Water that got through in ml"');
    expect(html).toContain("<caption");
    expect(html).toContain("They are not saved or sent.");
    const sample = renderToStaticMarkup(<MeasurementTableBlock block={ILLUSTRATIVE} />);
    expect(sample).toContain("Illustrative numbers, not real measurements.");
    expect(sample.match(/<input/g)).toHaveLength(1);
  });
  it("checks entries, derives the mean and range, and reports done once every cell is valid", () => {
    const onDone = vi.fn();
    const el = mount(<MeasurementTableBlock block={{ ...TABLE, trials: TABLE.trials.slice(0, 2) }} onDone={onDone} />);
    const inputs = [...el.querySelectorAll("input")];
    type(inputs[0], "300"); act(() => { inputs[0].dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(el.textContent).toContain("it should be from 0 ml to 250 ml");
    expect(inputs[0].getAttribute("aria-invalid")).toBe("true");
    type(inputs[0], "10"); type(inputs[1], "4"); type(inputs[2], "13"); type(inputs[3], "5.5");
    expect(el.querySelector('[data-derived-column="ml"] [data-derived="MEAN"]')?.textContent).toBe("Mean (average): 11.5 ml");
    expect(el.querySelector('[data-derived-column="ml"] [data-derived="RANGE"]')?.textContent).toBe("Range (largest minus smallest): 3 ml");
    expect(el.querySelector("[data-table-complete]")).not.toBeNull();
    expect(onDone).toHaveBeenLastCalledWith("cover-test", true);
  });
});

describe("DesignCycleBlock", () => {
  it("walks plan, safety, test and evaluate, then improves into a second design", () => {
    const onDone = vi.fn();
    const el = mount(<DesignCycleBlock block={DESIGN} onDone={onDone} />);
    expect((button(el, "Next: stay safe") as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('[data-stage="TEST"]') as HTMLButtonElement).disabled).toBe(true);
    type(el.querySelector("textarea")!, "A plastic sheet tied on with string.");
    click(button(el, "Next: stay safe"));
    const rules = [...el.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')];
    click(rules[0]);
    expect((button(el, "Next: test") as HTMLButtonElement).disabled).toBe(true);
    click(rules[1]);
    click(button(el, "Next: test"));
    expect(el.textContent).toContain("Pour one cup of water over the cover.");
    const [leakIn, holdIn] = [...el.querySelectorAll('[data-stage-body="TEST"] input')] as HTMLInputElement[];
    type(leakIn, "32"); type(holdIn, "18");
    click(button(el, "Next: check the results"));
    expect(el.textContent).toContain("Not yet: 32 ml, needed at most 20 ml. 12 ml over.");
    expect(el.querySelector("[data-design-feedback]")?.textContent).toContain("test design 2");
    expect(onDone).toHaveBeenLastCalledWith("cover", false);
    const next = button(el, "Test design 2") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    type(el.querySelector('[data-stage-body="EVALUATE"] textarea')!, "Use a double layer so less water gets through.");
    click(next);
    expect(el.querySelector("[data-design-iteration]")?.getAttribute("data-design-iteration")).toBe("2");
    expect((el.querySelector("textarea") as HTMLTextAreaElement).value).toBe("A plastic sheet tied on with string.");
    expect(el.textContent).toContain("Earlier designs (1)");
  });
  it("reports done when every criterion is met, with no grade language", () => {
    const onDone = vi.fn();
    const el = mount(<DesignCycleBlock block={{ ...DESIGN, criteria: [DESIGN.criteria[0]] }} onDone={onDone} />);
    click(el.querySelector('input[type=checkbox]')!);
    click(button(el, "Next: stay safe"));
    for (const box of el.querySelectorAll('[data-stage-body="SAFETY"] input[type=checkbox]')) click(box);
    click(button(el, "Next: test"));
    type(el.querySelector('[data-stage-body="TEST"] input')!, "10");
    click(button(el, "Next: check the results"));
    expect(el.querySelector("[data-design-status]")?.getAttribute("data-design-status")).toBe("ALL_CRITERIA_MET");
    expect(onDone).toHaveBeenLastCalledWith("cover", true);
    expect(el.textContent).not.toMatch(/\b(score|grade|failed)\b/i);
  });
});
