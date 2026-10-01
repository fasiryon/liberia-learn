// RX-005c: in-scene controls dispatch the same validated actions as their panel twins.
import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { controlAction, validateControls } from "@/lib/interactive-labs/v2/fidelity/controls";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { classifyLabAction } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import type { LabAction, LabState } from "@/lib/interactive-labs/v2/types";

const spec = hydropowerDefinition.fidelity!;
const controls = spec.components.filter((component) => component.control);
const play = (actions: LabAction[]): LabState => actions.reduce((state, action) => {
  const result = acceptLabAction(hydropowerDefinition, state, action);
  if ("reason" in result) throw new Error(result.reason);
  return result.state;
}, initializeLab(hydropowerDefinition));
const itemsWithControls = (state: LabState) => buildRenderList({ definition: hydropowerDefinition, state, profile: "HIGH" }).items.filter((item) => item.control);

describe("in-scene controls", () => {
  it("Mount Coffee declares the season post, the unit desk and the switchyard breakers, and they pass the gate", () => {
    expect(controls.map((component) => component.id)).toEqual(["gauge-band-1", "gauge-band-2", "gauge-band-3", "gauge-band-4", "gauge-band-5", "desk-start-next", "desk-stop-last", "breaker-hospital", "breaker-homes-less", "breaker-homes-more", "breaker-shops-less", "breaker-shops-more"]);
    expect(validateControls(spec)).toEqual([]);
  });

  it("dispatches only set-variable actions, classified exactly like the panel (RAW_OBSERVATION, never evidence)", () => {
    for (const item of itemsWithControls(play([]))) if (item.control?.action) {
      expect(item.control.action.type).toBe("set-variable");
      expect(classifyLabAction(item.control.action)).toBe(classifyLabAction({ type: "set-variable", variableId: item.control.action.variableId, value: item.control.action.value }));
    }
  });

  it("disables a control at its bound instead of clamping, and marks the selected season", () => {
    const start = itemsWithControls(play([]));
    expect(start.find((item) => item.id === "desk-start-next")?.control?.action).toBeNull();
    expect(start.find((item) => item.id === "breaker-homes-more")?.control?.action).toBeNull();
    expect(start.find((item) => item.id === "gauge-band-4")?.control).toMatchObject({ selected: true, action: null });
    expect(start.find((item) => item.id === "gauge-band-1")?.control?.action).toEqual({ type: "set-variable", variableId: "riverFlow", value: 49 });
    expect(start.find((item) => item.id === "breaker-hospital")?.control?.action).toEqual({ type: "set-variable", variableId: "feederHospital", value: 0 });
  });

  it("can solve the dry-season challenge by touching the plant alone", () => {
    const history: LabAction[] = [];
    let state = play([]);
    const tap = (id: string) => { const action = itemsWithControls(state).find((item) => item.id === id)?.control?.action; if (!action) throw new Error(`${id} disabled`); history.push(action); state = play(history); };
    tap("gauge-band-1");
    for (let i = 0; i < 4; i += 1) tap("breaker-homes-less");
    for (let i = 0; i < 3; i += 1) tap("breaker-shops-less");
    expect(state.fidelity?.variables).toMatchObject({ riverFlow: 49, homesBlocks: 0, shopsBlocks: 1, feederHospital: 1 });
    expect(buildRenderList({ definition: hydropowerDefinition, state, profile: "LOW" }).quantities.gridStableWithPriority).toBe(1);
  });

  it("is the same actionable set on every profile", () => {
    const state = play([{ type: "set-variable", variableId: "riverFlow", value: 49 }]);
    const views = (["HIGH", "STANDARD", "LOW", "FALLBACK_2D"] as const).map((profile) => instructionalView(buildRenderList({ definition: hydropowerDefinition, state, profile })).actionable);
    for (const view of views) expect(view).toEqual(views[0]);
    for (const control of controls) expect(views[0]).toContain(control.id);
  });

  it("rejects controls on unknown variables, off-grid values and toggles on non-toggle variables", () => {
    const bad = { ...spec, components: [
      { ...spec.components[0], id: "c1", control: { kind: "set-variable" as const, variableId: "nope", value: 1, label: "x" } },
      { ...spec.components[0], id: "c2", control: { kind: "set-variable" as const, variableId: "riverFlow", value: 50, label: "x" } },
      { ...spec.components[0], id: "c3", control: { kind: "toggle-variable" as const, variableId: "unitsOnline", label: "x" } },
    ] };
    expect(validateControls(bad)).toEqual(["control_variable_unknown:c1", "control_value_invalid:c2", "control_toggle_not_toggle:c3"]);
    expect(controlAction(spec, play([]).fidelity!, { kind: "step-variable", variableId: "unitsOnline", direction: -1, label: "x" })).toEqual({ type: "set-variable", variableId: "unitsOnline", value: 3 });
  });
});
