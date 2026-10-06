// @vitest-environment jsdom
// RX-005 A14: two-step (confirm) controls and drag-variable controls, on the shared control contract and in the
// player. The confirm preview is presentation only: it must never reach acceptLabAction (RX-005 test 2).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { circuitDefinition } from "@/lib/interactive-labs/v2/definitions/circuit";
import { activateControl, controlAction, dragAction, dragAxisEnds, dragParameter, dragValue, validateControls, type SceneControl } from "@/lib/interactive-labs/v2/fidelity/controls";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import type { HighFidelitySpec } from "@/lib/interactive-labs/v2/fidelity/types";
import type { CapabilityProfile } from "@/lib/interactive-labs/v2/types";

const kernelCalls = vi.hoisted(() => [] as { type: string }[]);
vi.mock("@/lib/interactive-labs/v2/kernel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/interactive-labs/v2/kernel")>();
  return { ...actual, acceptLabAction: (...args: Parameters<typeof actual.acceptLabAction>) => { kernelCalls.push(args[2] as { type: string }); return actual.acceptLabAction(...args); } };
});

const { initializeLab } = await import("@/lib/interactive-labs/v2/kernel");
const { InteractiveLabPlayer } = await import("@/components/interactive-labs/v2/InteractiveLabPlayer");

const spec = circuitDefinition.fidelity!;
const switchControl = spec.components.find((component) => component.id === "switch-lever")!.control!;
const resistorControl = spec.components.find((component) => component.id === "resistor")!.control! as Extract<SceneControl, { kind: "drag-variable" }>;

describe("A14 control contract", () => {
  it("the circuit fixture's confirm toggle and drag control pass the authoring gate", () => {
    expect(switchControl).toMatchObject({ kind: "toggle-variable", confirm: true });
    expect(resistorControl.kind).toBe("drag-variable");
    expect(validateControls(spec)).toEqual([]);
  });

  it("the gate rejects a drag control on a toggle, with an empty range, or with confirm", () => {
    const withControl = (control: SceneControl): HighFidelitySpec => ({ ...spec, components: spec.components.map((component) => component.id === "resistor" ? { ...component, control } : component) });
    expect(validateControls(withControl({ ...resistorControl, variableId: "switch" }))).toEqual(["control_drag_invalid:resistor"]);
    expect(validateControls(withControl({ ...resistorControl, worldRange: [0.3, 0.3] }))).toEqual(["control_drag_invalid:resistor"]);
    expect(validateControls(withControl({ ...resistorControl, confirm: true }))).toEqual(["control_drag_confirm:resistor"]);
  });

  it("a drag snaps to the step grid, stays in bounds and dispatches only when it crosses a step boundary", () => {
    // resistance: 2 to 20 Ω in steps of 2.
    expect(dragValue(spec, resistorControl, 0)).toBe(2);
    expect(dragValue(spec, resistorControl, 1)).toBe(20);
    expect(dragValue(spec, resistorControl, 0.5)).toBe(12);
    expect(dragValue(spec, resistorControl, -3)).toBe(2);
    expect(dragValue(spec, resistorControl, 9)).toBe(20);
    const state = initializeLab(circuitDefinition).fidelity!; // resistance starts at 6
    expect(dragAction(spec, state, resistorControl, 0.2)).toBeNull(); // still snaps to 6
    expect(dragAction(spec, state, resistorControl, 0.25)).toBeNull(); // 6.5 snaps back to 6
    expect(dragAction(spec, state, resistorControl, 0.3)).toEqual({ type: "set-variable", variableId: "resistance", value: 8 });
    expect(dragAction(spec, state, resistorControl, 1)).toEqual({ type: "set-variable", variableId: "resistance", value: 20 });
    // A tap on a drag control dispatches nothing; it is moved by dragging or by its range-input twin.
    expect(controlAction(spec, state, resistorControl)).toBeNull();
  });

  it("projects the pointer onto the drag axis on screen", () => {
    expect(dragParameter({ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 40, y: 25 })).toBeCloseTo(0.75);
    expect(dragParameter({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 })).toBe(0);
    expect(dragAxisEnds(resistorControl, [3, 0.3, 0])).toEqual([[3, -1.2, 0], [3, 1.8, 0]]);
  });

  it("a confirm control previews first and dispatches only on the second activation of the same part", () => {
    const action = { type: "set-variable" as const, variableId: "switch", value: 1 };
    const first = activateControl(null, "switch-lever", switchControl, action);
    expect(first).toEqual({ pending: { componentId: "switch-lever", label: "Switch on/off", action }, dispatch: null });
    expect(activateControl(first.pending, "switch-lever", switchControl, action)).toEqual({ pending: null, dispatch: action });
    // A disabled control does nothing and keeps any pending preview.
    expect(activateControl(first.pending, "switch-lever", switchControl, null)).toEqual({ pending: first.pending, dispatch: null });
    // A control without confirm dispatches at once and clears another part's preview.
    const plain = { ...switchControl, confirm: undefined };
    expect(activateControl(first.pending, "other", plain, action)).toEqual({ pending: null, dispatch: action });
  });

  it("the pending part is highlighted on every profile, carries its drag axis, and leaves the instructional view unchanged", () => {
    const state = initializeLab(circuitDefinition);
    const profiles: CapabilityProfile[] = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"];
    for (const profile of profiles) {
      const list = buildRenderList({ definition: circuitDefinition, state, profile, pendingControlId: "switch-lever" });
      const lever = list.items.find((item) => item.id === "switch-lever")!;
      expect(lever.highlighted).toBe(true);
      expect(lever.control?.pending).toBe(true);
      expect(list.items.find((item) => item.id === "resistor")!.control?.dragAxis).toEqual([[3, -1.2, 0], [3, 1.8, 0]]);
      expect(instructionalView(list)).toEqual(instructionalView(buildRenderList({ definition: circuitDefinition, state, profile })));
    }
  });
});

describe("A14 confirm preview in the player", () => {
  let host: HTMLDivElement, root: Root;
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); kernelCalls.length = 0; });
  const mount = () => {
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    act(() => root.render(<InteractiveLabPlayer labId={circuitDefinition.id} override="FALLBACK_2D" reviewPreview={{ initialState: initializeLab(circuitDefinition) }} />));
  };
  const chip = () => host.querySelector<HTMLButtonElement>('[data-lab-control="switch-lever"]')!;
  const strip = () => host.querySelector("[data-lab-pending-control]");

  it("the first activation only previews (no acceptLabAction call); Confirm dispatches", () => {
    mount();
    kernelCalls.length = 0;
    act(() => chip().click());
    expect(strip()?.textContent).toContain("Confirm? Switch on/off");
    // Announced through the player's permanently mounted live region; the chip's name carries the pending state.
    expect(host.querySelector("[aria-live=assertive]")?.textContent).toBe("Confirm? Switch on/off");
    expect(chip().getAttribute("aria-label")).toBe("Confirm? Switch lever");
    expect(kernelCalls).toEqual([]);
    expect(chip().getAttribute("aria-pressed")).toBe("false");
    act(() => [...strip()!.querySelectorAll("button")].find((button) => button.textContent === "Confirm")!.click());
    expect(strip()).toBeNull();
    expect(kernelCalls).toEqual([{ type: "set-variable", variableId: "switch", value: 1 }]);
    expect(chip().getAttribute("aria-pressed")).toBe("true");
  });

  it("Escape and Cancel clear the preview without dispatching", () => {
    mount();
    kernelCalls.length = 0;
    act(() => chip().click());
    act(() => { chip().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(strip()).toBeNull();
    act(() => chip().click());
    act(() => [...strip()!.querySelectorAll("button")].find((button) => button.textContent === "Cancel")!.click());
    expect(strip()).toBeNull();
    expect(kernelCalls).toEqual([]);
  });

  it("moving focus out of the scene clears the preview (blur), with no timer", () => {
    vi.useFakeTimers();
    try {
      mount();
      kernelCalls.length = 0;
      act(() => { chip().focus(); chip().click(); });
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(strip()).not.toBeNull();
      const outside = host.querySelector<HTMLElement>("#profile")!;
      act(() => outside.focus());
      expect(strip()).toBeNull();
      expect(kernelCalls).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it("the drag control's twin is a range input on the variable's step grid", () => {
    mount();
    const range = host.querySelector<HTMLInputElement>('input[type=range][data-lab-control="resistor"]')!;
    expect(range).not.toBeNull();
    expect([range.min, range.max, range.step, range.value]).toEqual(["2", "20", "2", "6"]);
  });
});

describe("A14 control affordance token", () => {
  it("FALLBACK_2D rings every control part with its glyph and labels a pending part Confirm?", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Fallback2D } = await import("@/components/interactive-labs/v2/Fallback2D");
    const render = (pendingControlId: string | null) => renderToStaticMarkup(<Fallback2D definition={circuitDefinition} state={initializeLab(circuitDefinition)} reducedMotion traceFlowId={null} dispatch={() => {}} onPick={() => {}} pendingControlId={pendingControlId} />);
    const idle = render(null);
    expect(idle).toContain('data-lab-control-affordance="switch-lever"');
    expect(idle).toContain('data-lab-control-affordance="resistor"');
    expect(idle).toContain(">↕</text>");
    expect(idle).not.toContain("data-lab-pending-label");
    expect(render("switch-lever")).toContain('data-lab-pending-label="switch-lever"');
  });

  it("the WebGL overlay draws the same token and the pending label", async () => {
    const { controlAffordanceElements, controlCursor } = await import("@/components/interactive-labs/v2/sceneCues");
    const items = buildRenderList({ definition: circuitDefinition, state: initializeLab(circuitDefinition), profile: "LOW", pendingControlId: "switch-lever" }).items;
    const nodes = controlAffordanceElements(items, (point) => ({ x: point[0] * 10, y: point[1] * 10 }));
    expect(nodes.map((node) => node.dataset.labControlAffordance ?? `label:${node.dataset.labPendingLabel}`).sort()).toEqual(["label:switch-lever", "resistor", "switch-lever"]);
    expect(nodes.find((node) => node.dataset.labControlAffordance === "resistor")!.textContent).toBe("↕");
    expect([controlCursor(undefined), controlCursor({}), controlCursor({ dragAxis: [[0, 0, 0], [0, 1, 0]] })]).toEqual(["", "pointer", "grab"]);
  });
});
