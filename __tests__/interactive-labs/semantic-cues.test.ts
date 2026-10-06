// RX-005 A1: every part a check asks the learner to tell apart declares semantic cues, and each declared cue holds in
// LOW and FALLBACK_2D exactly as in HIGH, across every registered lab's reference states.
import { describe, expect, it } from "vitest";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { LAB_REVIEW_SCENARIO_SETS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";
import { buildRenderList, fallbackVisibleItems, type RenderItem } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { checkCriticalComponentIds, validateSemanticCues } from "@/lib/interactive-labs/v2/fidelity/semanticCues";
import { circuitDefinition } from "@/lib/interactive-labs/v2/definitions/circuit";
import type { InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";

const fidelityLabs = Object.keys(LAB_REVIEW_SCENARIO_SETS).map((id) => getInteractiveLabDefinition(id)!).filter((definition) => definition.fidelity);

function referenceStates(definition: InteractiveLabDefinition<LabState>): { id: string; state: LabState }[] {
  const states = [{ id: "initial", state: initializeLab(definition) }];
  for (const scenario of LAB_REVIEW_SCENARIO_SETS[definition.id].scenarios) {
    const replay = replayReviewScenario(definition, scenario);
    if (replay.ok) states.push({ id: scenario.id, state: replay.state });
  }
  return states;
}

/** What a learner can use to tell a part apart, independent of mesh detail. */
const identity = (item: RenderItem | undefined) => item && { label: item.label, actionable: item.selectable && item.inFocus, status: item.status?.text ?? null, glyph: item.status?.glyph ?? null };

describe("RX-005 A1 semantic cues", () => {
  it("every registered high-fidelity lab declares cues for each check-critical part, never shape alone", () => {
    expect(fidelityLabs.map((definition) => definition.id).sort()).toEqual(["fixture-simple-circuit", "g4-solid-figures", "mount-coffee-hydropower"]);
    for (const definition of fidelityLabs) {
      expect(checkCriticalComponentIds(definition).length, definition.id).toBeGreaterThan(0);
      expect(validateSemanticCues(definition), definition.id).toEqual([]);
    }
  });

  it("the gate rejects a missing declaration and a shape-only declaration", () => {
    const strip = (id: string, cues?: readonly ("shape" | "label")[]) => ({ ...circuitDefinition, fidelity: { ...circuitDefinition.fidelity!, components: circuitDefinition.fidelity!.components.map((component) => component.id === id ? { ...component, semanticCues: cues } : component) } });
    expect(validateSemanticCues(strip("bulb-filament"))).toEqual(["semantic_cues_missing:bulb-filament"]);
    expect(validateSemanticCues(strip("battery", ["shape"]))).toEqual(["semantic_cues_shape_only:battery"]);
  });

  it("each declared cue survives LOW and FALLBACK_2D with the same identity as HIGH", () => {
    let proven = 0;
    const statusSeen = new Set<string>();
    for (const definition of fidelityLabs) {
      const spec = definition.fidelity!;
      for (const { id: stateId, state } of referenceStates(definition)) {
        const high = buildRenderList({ definition, state, profile: "HIGH" }).items;
        const low = buildRenderList({ definition, state, profile: "LOW" }).items;
        const flat = fallbackVisibleItems(buildRenderList({ definition, state, profile: "FALLBACK_2D" }).items);
        // Every check-critical part, and every other part that declares cues (e.g. unit status lamps).
        const declared = [...new Set([...checkCriticalComponentIds(definition), ...spec.components.filter((component) => component.semanticCues?.length).map((component) => component.id)])];
        for (const componentId of declared) {
          const reference = high.find((item) => item.id === componentId);
          // A part cut away by a section is shown only where the device can clip it; nothing a check needs is cut.
          if (!reference || reference.clip) continue;
          const where = `${definition.id}/${stateId}/${componentId}`;
          expect(identity(low.find((item) => item.id === componentId)), `${where} LOW`).toEqual(identity(reference));
          expect(identity(flat.find((item) => item.id === componentId)), `${where} FALLBACK_2D`).toEqual(identity(reference));
          const cues = spec.components.find((component) => component.id === componentId)!.semanticCues!;
          if (cues.includes("label")) expect(reference.label.trim(), `${where} label`).not.toBe("");
          if (cues.includes("target")) {
            const traceable = spec.flows.some((flow) => flow.nodes.some((node) => node.traceable && node.componentId === componentId));
            const control = spec.components.find((component) => component.id === componentId)!.control;
            expect(reference.selectable || traceable || !!control, `${where} target`).toBe(true);
          }
          if (cues.includes("status") && reference.status) statusSeen.add(componentId);
          proven += 1;
        }
      }
    }
    expect(proven).toBeGreaterThan(100);
    // A part that declares a status cue shows its glyph and text (not colour alone) in at least one reference state.
    for (const definition of fidelityLabs) for (const component of definition.fidelity!.components) if (component.semanticCues?.includes("status")) expect(statusSeen.has(component.id), component.id).toBe(true);
  });
});
