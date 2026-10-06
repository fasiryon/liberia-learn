import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";

const stateAfter = (...actions: Parameters<typeof acceptLabAction>[2][]) => actions.reduce((state, action) => {
  const result = acceptLabAction(hydropowerDefinition, state, action);
  if ("reason" in result) throw new Error(result.reason);
  return result.state;
}, initializeLab(hydropowerDefinition));

const unit = (state: ReturnType<typeof stateAfter>, id: string) => buildRenderList({ definition: hydropowerDefinition, state, profile: "FALLBACK_2D" }).items.find((item) => item.id === id)!;

describe("Mount Coffee output driven unit status lamps", () => {
  it("makes generating and idle units visibly different", () => {
    const state = stateAfter({ type: "set-variable", variableId: "homesBlocks", value: 0 }, { type: "set-variable", variableId: "shopsBlocks", value: 1 }, { type: "set-variable", variableId: "riverFlow", value: 49 });
    expect(unit(state, "unit-1")).toMatchObject({ color: "#22c55e", emissive: 1 });
    expect(unit(state, "unit-2")).toMatchObject({ color: "#f59e0b", emissive: 0.18 });
  });

  it("shows a latched trip and a repaired unit as distinct states", () => {
    const tripped = stateAfter({ type: "set-variable", variableId: "riverFlow", value: 49 });
    expect(unit(tripped, "unit-1")).toMatchObject({ color: "#ef4444", emissive: 0.45 });
    const repair = stateAfter({ type: "clear-assembly", assemblyId: "unit-3" });
    expect(unit(repair, "u3-runner")).toMatchObject({ color: "#a855f7", emissive: 0.18 });
  });

  it("keeps the same status semantics in every capability profile", () => {
    const state = stateAfter({ type: "set-variable", variableId: "homesBlocks", value: 0 }, { type: "set-variable", variableId: "shopsBlocks", value: 1 }, { type: "set-variable", variableId: "riverFlow", value: 49 });
    for (const profile of ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"] as const) {
      const list = buildRenderList({ definition: hydropowerDefinition, state, profile });
      expect(list.items.find((item) => item.id === "unit-1")?.color, profile).toBe("#22c55e");
      expect(list.items.find((item) => item.id === "unit-2")?.color, profile).toBe("#f59e0b");
    }
  });
});
