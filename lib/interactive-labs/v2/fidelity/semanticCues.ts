// RX-005 A1: semantic cues. A part a check, prompt or explanation asks the learner to tell apart must declare how it
// can be told apart on every profile, LOW and FALLBACK_2D included. Geometric inequality alone ("shape") never counts:
// at least one cue must survive a low-detail or flat projection (a label, a status glyph and text, or an interaction
// target). __tests__/interactive-labs/semantic-cues.test.ts proves each declared cue in LOW and FALLBACK_2D.
import type { InteractiveLabDefinition, LabState } from "../types";

export const SEMANTIC_CUES = ["shape", "label", "glyph", "status", "target"] as const;
export type SemanticCue = (typeof SEMANTIC_CUES)[number];

/** Components the learner must distinguish: check targets, traceable path parts, buildable assembly parts and controls. */
export function checkCriticalComponentIds(definition: InteractiveLabDefinition<LabState>): string[] {
  const spec = definition.fidelity;
  if (!spec) return [];
  const ids = new Set<string>();
  for (const check of definition.checks) {
    const fidelity = check.fidelity;
    if (fidelity?.kind === "identify-component") ids.add(fidelity.componentId);
    if (fidelity?.kind === "trace-path") for (const node of spec.flows.find((flow) => flow.id === fidelity.flowId)?.nodes ?? []) if (node.traceable && node.componentId) ids.add(node.componentId);
    if (fidelity?.kind === "assemble") for (const id of spec.assemblies.find((assembly) => assembly.id === fidelity.assemblyId)?.componentIds ?? []) ids.add(id);
  }
  for (const component of spec.components) if (component.control) ids.add(component.id);
  return [...ids].filter((id) => spec.components.some((component) => component.id === id)).sort();
}

/** Authoring gate: every check-critical part declares cues, and at least one of them is not shape alone. */
export function validateSemanticCues(definition: InteractiveLabDefinition<LabState>): string[] {
  const spec = definition.fidelity;
  if (!spec) return [];
  const errors: string[] = [];
  for (const id of checkCriticalComponentIds(definition)) {
    const cues = spec.components.find((component) => component.id === id)?.semanticCues ?? [];
    if (!cues.length) errors.push(`semantic_cues_missing:${id}`);
    else if (cues.every((cue) => cue === "shape")) errors.push(`semantic_cues_shape_only:${id}`);
    for (const cue of cues) if (!SEMANTIC_CUES.includes(cue)) errors.push(`semantic_cue_unknown:${id}:${cue}`);
  }
  return errors;
}
