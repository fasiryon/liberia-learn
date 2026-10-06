// RX-006 test 3: deterministic city-block, gauge-band and breaker combinations give the same actionable component ids,
// the same control actions (scene tap = chip twin = keyboard) and the same focused/selected feedback on every profile.
import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { controlAction, controlSelected } from "@/lib/interactive-labs/v2/fidelity/controls";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import type { LabAction, LabState } from "@/lib/interactive-labs/v2/types";

const PROFILES = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"] as const;
const spec = hydropowerDefinition.fidelity!;
const play = (actions: LabAction[]): LabState => actions.reduce((state, action) => {
  const result = acceptLabAction(hydropowerDefinition, state, action);
  return "reason" in result ? state : result.state;
}, initializeLab(hydropowerDefinition));

describe("RX-006 test 3: challenge parity across profiles", () => {
  const combos: { name: string; actions: LabAction[] }[] = [];
  for (const hospital of [0, 1]) for (const homes of [0, 2, 4]) for (const shops of [0, 1, 4]) for (const flow of [49, 430]) {
    combos.push({ name: `h${hospital} homes${homes} shops${shops} flow${flow}`, actions: [{ type: "mode", mode: "CHALLENGE" }, { type: "set-variable", variableId: "riverFlow", value: flow },
      { type: "set-variable", variableId: "feederHospital", value: hospital }, { type: "set-variable", variableId: "homesBlocks", value: homes }, { type: "set-variable", variableId: "shopsBlocks", value: shops }] });
  }
  for (const id of ["gauge-band-2", "breaker-shops-more"]) combos.push({ name: `inspect ${id}`, actions: [{ type: "mode", mode: "CHALLENGE" }, { type: "inspect-component", componentId: id }] });

  it.each(combos)("$name", ({ actions }) => {
    const state = play(actions);
    const lists = PROFILES.map((profile) => buildRenderList({ definition: hydropowerDefinition, state, profile }));
    const views = lists.map(instructionalView);
    for (const view of views) expect(view).toEqual(views[0]);
    // Every control part is present and tappable on every profile, with the same action and selected state as its chip
    // (the chip and keyboard path dispatch controlAction for the same control), and the same highlight.
    for (const component of spec.components.filter((candidate) => candidate.control)) {
      const chip = { action: controlAction(spec, state.fidelity!, component.control!), selected: controlSelected(state.fidelity!, component.control!) };
      for (const [index, list] of lists.entries()) {
        const item = list.items.find((candidate) => candidate.id === component.id);
        expect(item, `${component.id} on ${PROFILES[index]}`).toBeDefined();
        expect([item!.selectable, item!.control?.action ?? null, item!.control?.selected]).toEqual([true, chip.action, chip.selected]);
        expect(item!.highlighted).toBe(lists[0].items.find((candidate) => candidate.id === component.id)!.highlighted);
      }
    }
    // City blocks carry their own lit state on every profile (never collapsed into one batch state).
    const blocks = (index: number) => lists[index].items.filter((item) => /^city-(hospital|homes-b|shops-b)/.test(item.id)).map((item) => [item.id, Math.round(item.emissive * 100), item.color]);
    expect(blocks(0)).toHaveLength(9);
    for (let index = 1; index < lists.length; index += 1) expect(blocks(index)).toEqual(blocks(0));
  });
});
