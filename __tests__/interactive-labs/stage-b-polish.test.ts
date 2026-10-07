import { describe, expect, it } from "vitest";
import { hydropowerDefinition as definition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { acceptLabAction } from "@/lib/interactive-labs/v2/kernel";
import { guidedPrompt } from "@/lib/interactive-labs/v2/fidelity/guidance";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { layoutControlTargets } from "@/components/interactive-labs/v2/controlTargets";
import type { LabAction, LabState } from "@/lib/interactive-labs/v2/types";

const act = (state: LabState, action: LabAction) => {
  const result = acceptLabAction(definition, state, action);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.state;
};

describe("Mount Coffee Stage B state and interaction", () => {
  it("describes the selected flood fixture and the simplified steady headpond", () => {
    let state = act(definition.initialState, { type: "guided-step", index: 3 });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("headpond level steady");
    state = act(state, { type: "set-variable", variableId: "riverFlow", value: 557 });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("Flood flow is selected");
  });
  it("follows open internals, changed demand, trip correction and explicit reset", () => {
    let state = act(definition.initialState, { type: "guided-step", index: 2 });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("Open the powerhouse");
    state = act(state, { type: "set-cutaway", cutawayId: "powerhouse-section" });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("Unit 3 is open");
    state = act(state, { type: "guided-step", index: 4 });
    state = act(state, { type: "set-variable", variableId: "shopsBlocks", value: 2 });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("60 MW");
    state = act(state, { type: "set-variable", variableId: "shopsBlocks", value: 4 });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("tripped");
    state = act(state, { type: "set-variable", variableId: "shopsBlocks", value: 2 });
    expect(guidedPrompt(definition.fidelity!, state.fidelity!)).toContain("does not restore it automatically");
    expect(buildRenderList({ definition, state, profile: "LOW" }).quantities.suppliedMW).toBe(0);
    state = act(state, { type: "reset-protection" });
    expect(buildRenderList({ definition, state, profile: "LOW" }).quantities.suppliedMW).toBe(60);
  });

  it("allocates all close-packed controls disjoint 44px hit proxies within phone bounds", () => {
    const items = buildRenderList({ definition, state: definition.initialState, profile: "LOW" }).items.filter(item => item.control);
    for (const [width, height] of [[390, 420], [506, 318]]) {
      const targets = layoutControlTargets(items, () => ({ x: width / 2, y: height / 2 }), width, height);
      expect(targets).toHaveLength(items.length);
      for (const target of targets) {
        expect(target.center.x - 22).toBeGreaterThanOrEqual(0);
        expect(target.center.x + 22).toBeLessThanOrEqual(width);
        expect(target.center.y - 22).toBeGreaterThanOrEqual(0);
        expect(target.center.y + 22).toBeLessThanOrEqual(height);
        for (const other of targets.filter(t => t !== target)) expect(Math.abs(target.center.x - other.center.x) >= 48 || Math.abs(target.center.y - other.center.y) >= 48).toBe(true);
      }
    }
  });

  it("keeps controls above a phone sheet without changing their model-space anchors", () => {
    const items = buildRenderList({ definition, state: definition.initialState, profile: "LOW" }).items.filter(item => item.control);
    const targets = layoutControlTargets(items, () => ({ x: 195, y: 400 }), 390, 524, 240);
    expect(targets).toHaveLength(items.length);
    expect(targets.every(target => target.center.y + 22 <= 240 && target.anchor.y === 400)).toBe(true);
  });

  it("keeps proxy hit regions clear of instructional label plates", () => {
    const items = buildRenderList({ definition, state: definition.initialState, profile: "LOW" }).items.filter(item => item.control);
    const rect = { left: 100, right: 290, top: 190, bottom: 230 };
    const targets = layoutControlTargets(items, () => ({ x: 195, y: 210 }), 390, 420, 420, [rect]);
    expect(targets).toHaveLength(items.length);
    expect(targets.every(({ center }) => center.x + 26 <= rect.left || center.x - 26 >= rect.right || center.y + 26 <= rect.top || center.y - 26 >= rect.bottom)).toBe(true);
  });
});
