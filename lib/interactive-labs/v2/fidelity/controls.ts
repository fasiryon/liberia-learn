// RX-005c: in-scene controls. A control part on the model dispatches exactly the validated `set-variable`
// action its panel twin dispatches, so validation and evidence classification are unchanged (RAW_OBSERVATION).
import type { FidelityAction, FidelityState, HighFidelitySpec } from "./types";

export type SceneControl =
  | { kind: "set-variable"; variableId: string; value: number; label: string }
  | { kind: "step-variable"; variableId: string; direction: 1 | -1; label: string }
  | { kind: "toggle-variable"; variableId: string; label: string };

/**
 * The action a control would dispatch in this state, or null when it would do nothing (already at the value
 * or at a bound). A null control is shown disabled; nothing is clamped.
 */
export function controlAction(spec: HighFidelitySpec, state: FidelityState, control: SceneControl): Extract<FidelityAction, { type: "set-variable" }> | null {
  const variable = spec.variables.find((candidate) => candidate.id === control.variableId);
  if (!variable) return null;
  const current = state.variables[control.variableId] ?? variable.initial;
  const next = control.kind === "set-variable" ? control.value
    : control.kind === "toggle-variable" ? (current > variable.min ? variable.min : variable.max)
    : current + control.direction * variable.step;
  if (next === current || next < variable.min - 1e-9 || next > variable.max + 1e-9) return null;
  return { type: "set-variable", variableId: control.variableId, value: next };
}

/** Whether a set-variable control currently shows the selected value (for pressed/selected state). */
export function controlSelected(state: FidelityState, control: SceneControl): boolean {
  return control.kind === "set-variable" && state.variables[control.variableId] === control.value;
}

/** Authoring gate: every control names a learner-controlled variable and a value on its step grid. */
export function validateControls(spec: HighFidelitySpec): string[] {
  const errors: string[] = [];
  for (const component of spec.components) {
    const control = component.control;
    if (!control) continue;
    const variable = spec.variables.find((candidate) => candidate.id === control.variableId);
    if (!variable || !variable.learnerControlled) { errors.push(`control_variable_unknown:${component.id}`); continue; }
    if (component.detail === "decor") errors.push(`control_on_decor:${component.id}`);
    if (!control.label.trim()) errors.push(`control_label_missing:${component.id}`);
    if (control.kind === "set-variable") {
      const steps = (control.value - variable.min) / variable.step;
      if (control.value < variable.min || control.value > variable.max || Math.abs(steps - Math.round(steps)) > 1e-9) errors.push(`control_value_invalid:${component.id}`);
    }
    if (control.kind === "toggle-variable" && variable.kind !== "toggle") errors.push(`control_toggle_not_toggle:${component.id}`);
  }
  return errors;
}
