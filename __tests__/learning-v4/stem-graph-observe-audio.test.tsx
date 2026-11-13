// @vitest-environment jsdom
// teaching-blocks/1.2.0 GRAPH_BUILDER, OBSERVATION_LOG and AUDIO_PROMPT renderers, and the bounded ActivityScope that
// lets a learner's MEASUREMENT_TABLE entries flow into the graph named by sourceBlockId. Fixtures are component fixtures.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { validateBlock_1_2, validateBlockReferences_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";
import { checkAxes, graphPoints, graphSummary, niceScale, validateGraphBuilder, type GraphBuilderData } from "@/lib/learner-experience/stem/graphBuilder";
import type { MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";
import { ActivityScope } from "@/components/experience/blocks/stem/ActivityScope";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import { GraphBuilderBlock } from "@/components/experience/blocks/stem/GraphBuilderBlock";
import { entryRecorded, ObservationLogBlock, validateObservationLog, type ObservationLogData } from "@/components/experience/blocks/stem/ObservationLogBlock";
import { AudioPromptBlock, validateAudioPrompt, type AudioPromptData } from "@/components/experience/blocks/stem/AudioPromptBlock";

const TABLE: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "cover-test", title: "Water through each cover", origin: "MEASURED_BY_LEARNER", originNote: "Use the class cup.",
  columns: [{ id: "layers", label: "Layers of plastic", unit: "", precision: 0, minimum: 1, maximum: 5 }, { id: "ml", label: "Water that got through", unit: "ml", precision: 0, minimum: 0, maximum: 250 }],
  trials: [{ layers: null, ml: null }, { layers: null, ml: null }, { layers: null, ml: null }], derived: [] };
const GRAPH: GraphBuilderData = { type: "GRAPH_BUILDER", id: "cover-graph", prompt: "Graph water against layers.", sourceBlockId: "cover-test", allowedKinds: ["BAR", "LINE"],
  axisRules: { xColumn: "layers", yColumn: "ml", zeroBaselineRequired: true } };
const OBSERVE: ObservationLogData = { type: "OBSERVATION_LOG", id: "ice", prompt: "What happened to the ice?", origin: "MEASURED_BY_LEARNER",
  fields: [{ id: "saw", label: "What I saw" }, { id: "think", label: "What I think happened" }], maxEntries: 2, responseModes: ["ORAL_WITH_SCRIBE", "DRAWING"] };
const AUDIO: AudioPromptData = { type: "AUDIO_PROMPT", id: "listen", text: "Put the ice in the sun.", lang: "en-LR", fallback: "TEXT_AND_TEACHER_READ_ALOUD", autoplay: false };

describe("fixtures are valid under the canonical 1.2.0 registry", () => {
  it("validates each block for its grade band and the graph's same-package reference", () => {
    expect(validateBlock_1_2(TABLE, { subject: "ENGINEERING", grade: 4 }).problems).toEqual([]);
    expect(validateBlock_1_2(GRAPH, { subject: "ENGINEERING", grade: 4 }).problems).toEqual([]);
    expect(validateBlockReferences_1_2([TABLE, GRAPH])).toEqual([]);
    expect(validateBlock_1_2(OBSERVE, { subject: "SCIENCE", grade: 1 }).problems).toEqual([]);
    expect(validateBlock_1_2(AUDIO, { subject: "SCIENCE", grade: 0 }).problems).toEqual([]);
  });
  it("renderers refuse what the registry refuses", () => {
    expect(() => validateGraphBuilder({ ...GRAPH, allowedKinds: ["PIE"] })).toThrow("graph_builder_invalid");
    expect(() => validateGraphBuilder({ ...GRAPH, axisRules: { ...GRAPH.axisRules, yColumn: "layers" } })).toThrow("same_axis_column");
    expect(() => validateObservationLog({ ...OBSERVE, origin: "ILLUSTRATIVE" })).toThrow("observation_log_invalid");
    expect(() => validateAudioPrompt({ ...AUDIO, autoplay: true })).toThrow("audio_prompt_invalid");
  });
});

describe("GRAPH_BUILDER model", () => {
  const cols = TABLE.columns;
  it("says what to change about the axes", () => {
    expect(checkAxes(GRAPH, cols, "", "")).toMatchObject({ state: "INCOMPLETE" });
    expect(checkAxes(GRAPH, cols, "layers", "ml")).toMatchObject({ state: "CORRECT", message: "Good: Layers of plastic along the bottom, Water that got through (ml) up the side." });
    expect(checkAxes(GRAPH, cols, "ml", "layers")).toMatchObject({ state: "SWAPPED" });
    expect(checkAxes(GRAPH, cols, "layers", "layers")).toMatchObject({ state: "WRONG" });
  });
  it("plots only complete trials, in trial order", () => {
    expect(graphPoints([{ layers: 1, ml: 80 }, { layers: null, ml: 40 }, { layers: 3, ml: 10 }], "layers", "ml")).toEqual([{ trial: 1, x: 1, y: 80 }, { trial: 3, x: 3, y: 10 }]);
  });
  it("uses readable axis steps and starts at zero when required", () => {
    expect(niceScale([12, 80], true)).toEqual({ min: 0, max: 80, ticks: [0, 20, 40, 60, 80] });
    expect(niceScale([52, 80], false)).toEqual({ min: 50, max: 80, ticks: [50, 60, 70, 80] });
    expect(niceScale([52, 80], true).min).toBe(0);
    expect(niceScale([5, 5], false).ticks.length).toBeGreaterThan(1);
  });
  it("summarises the picture in words", () => {
    expect(graphSummary("BAR", [{ trial: 1, x: 1, y: 80 }, { trial: 2, x: 3, y: 10 }], cols[0], cols[1])).toBe("Bar graph of Water that got through (ml) against Layers of plastic, 2 points. Highest: 80 at 1. Lowest: 10 at 3.");
  });
});

let root: Root | null = null, host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); vi.unstubAllGlobals(); });
const mount = (node: React.ReactNode) => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); act(() => root!.render(node)); return host; };
const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
});
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });

describe("one activity: measurements flow into the graph, bounded to the scope", () => {
  it("graphs the learner's own entries from the table in the same ActivityScope", () => {
    const onDone = vi.fn();
    const el = mount(<ActivityScope><MeasurementTableBlock block={TABLE} /><GraphBuilderBlock block={GRAPH} onDone={onDone} /></ActivityScope>);
    const graph = el.querySelector('[data-block-type="GRAPH_BUILDER"]')!;
    const [x, y] = [...graph.querySelectorAll("select")];
    setValue(x, "ml"); setValue(y, "layers");
    expect(graph.querySelector("[data-axis-check]")?.getAttribute("data-axis-check")).toBe("SWAPPED");
    setValue(x, "layers"); setValue(y, "ml");
    click(graph.querySelectorAll('input[type=radio]')[0]);
    expect(graph.querySelector("[data-graph-needs-points]")).not.toBeNull();
    const cells = [...el.querySelectorAll('[data-block-type="MEASUREMENT_TABLE"] input')] as HTMLInputElement[];
    setValue(cells[0], "1"); setValue(cells[1], "80"); setValue(cells[2], "2"); setValue(cells[3], "35"); setValue(cells[4], "3"); setValue(cells[5], "999");
    const svg = graph.querySelector("svg")!;
    expect(svg.querySelectorAll("rect.ll8-bar")).toHaveLength(2);
    expect(svg.getAttribute("aria-label")).toBe("Bar graph of Water that got through (ml) against Layers of plastic, 2 points. Highest: 80 at 1. Lowest: 35 at 2.");
    expect(onDone).toHaveBeenLastCalledWith("cover-graph", true);
    setValue(cells[5], "10");
    expect(graph.querySelectorAll("rect.ll8-bar")).toHaveLength(3);
  });
  it("outside a scope, or in another scope, the graph sees no table and asks for it", () => {
    expect(renderToStaticMarkup(<GraphBuilderBlock block={GRAPH} />)).toContain("Fill in the table first");
    const el = mount(<><ActivityScope><MeasurementTableBlock block={TABLE} /></ActivityScope><ActivityScope><GraphBuilderBlock block={GRAPH} /></ActivityScope></>);
    expect(el.querySelector("[data-graph-waiting]")).not.toBeNull();
  });
  it("the shared state goes away with the activity", () => {
    const el = mount(<ActivityScope><MeasurementTableBlock block={TABLE} /><GraphBuilderBlock block={GRAPH} /></ActivityScope>);
    expect(el.querySelector("[data-graph-waiting]")).toBeNull();
    act(() => root!.render(<ActivityScope><GraphBuilderBlock block={GRAPH} /></ActivityScope>));
    expect(el.querySelector("[data-graph-waiting]")).not.toBeNull();
  });
});

describe("OBSERVATION_LOG", () => {
  it("records by telling the teacher or drawing, with a paper option, and never judges", () => {
    const onDone = vi.fn();
    const el = mount(<ObservationLogBlock block={OBSERVE} onDone={onDone} />);
    expect(onDone).toHaveBeenLastCalledWith("ice", false);
    click([...el.querySelectorAll("button")].find((b) => b.textContent === "Add an observation")!);
    expect(el.textContent).toContain("(your teacher writes what you say)");
    setValue(el.querySelector("textarea")!, "It melted into water.");
    expect(onDone).toHaveBeenLastCalledWith("ice", true);
    click(el.querySelectorAll('input[type=radio]')[1]);
    click([...el.querySelectorAll("button")].find((b) => b.textContent === "Add another observation")!);
    const drawing = el.querySelector('[data-entry-mode="DRAWING"]')!;
    expect(drawing.querySelector("canvas")?.getAttribute("aria-label")).toContain("I drew it on paper instead");
    click(drawing.querySelector('input[type=checkbox]')!);
    expect(drawing.hasAttribute("data-entry-recorded")).toBe(true);
    expect(el.textContent).toContain("That is all 2 observations for this activity.");
    expect(el.textContent).not.toMatch(/\b(correct|wrong|score|grade)\b/i);
  });
  it("an entry counts only once something is recorded", () => {
    expect(entryRecorded({ mode: "TEXT", values: { saw: "  " }, drew: false, onPaper: false })).toBe(false);
    expect(entryRecorded({ mode: "DRAWING", values: {}, drew: true, onPaper: false })).toBe(true);
  });
});

describe("AUDIO_PROMPT", () => {
  it("shows the words, never autoplays, speaks on request and never gates Continue", () => {
    const speak = vi.fn(), cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; lang = ""; rate = 1; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t; } });
    const onDone = vi.fn();
    const el = mount(<AudioPromptBlock block={AUDIO} onDone={onDone} />);
    expect(el.querySelector('[lang="en-LR"]')?.textContent).toBe("Put the ice in the sun.");
    expect(speak).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith("listen", true);
    click([...el.querySelectorAll("button")].find((b) => b.textContent?.includes("Listen"))!);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "Put the ice in the sun.", lang: "en" });
  });
  it("without device speech it falls back to the teacher reading aloud", () => {
    const el = mount(<AudioPromptBlock block={AUDIO} />);
    if (!("speechSynthesis" in window)) expect(el.querySelector("[data-audio-fallback]")?.textContent).toBe("Ask your teacher to read this with you.");
    expect(renderToStaticMarkup(<AudioPromptBlock block={AUDIO} />)).toContain("Ask your teacher to read this with you.");
  });
});
