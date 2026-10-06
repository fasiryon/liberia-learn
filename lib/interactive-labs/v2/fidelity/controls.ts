// RX-005c: in-scene controls. A control part on the model dispatches exactly the validated `set-variable`
// action its panel twin dispatches, so validation and evidence classification are unchanged (RAW_OBSERVATION).
import type { FidelityAction, FidelityState, HighFidelitySpec } from "./types";

/**
 * `group` places related controls in one chip row (default: one row per variable). `confirm` gives a two-step
 * activation (A14): the first activation only shows a presentation-only pending preview, the second dispatches.
 */
type ControlBase = { variableId: string; label: string; group?: string; groupLabel?: string; confirm?: true };
export type SceneControl =
  | ControlBase & { kind: "set-variable"; value: number }
  | ControlBase & { kind: "step-variable"; direction: 1 | -1 }
  | ControlBase & { kind: "toggle-variable" }
  /** A14: dragging the part along `axis` across `worldRange` (world units) maps linearly onto the variable's range. */
  | ControlBase & { kind: "drag-variable"; axis: "x" | "y" | "z"; worldRange: [number, number] };

/**
 * The action a control would dispatch in this state, or null when it would do nothing (already at the value
 * or at a bound). A null control is shown disabled; nothing is clamped.
 */
export function controlAction(spec: HighFidelitySpec, state: FidelityState, control: SceneControl): Extract<FidelityAction, { type: "set-variable" }> | null {
  const variable = spec.variables.find((candidate) => candidate.id === control.variableId);
  if (!variable || control.kind === "drag-variable") return null;
  const current = state.variables[control.variableId] ?? variable.initial;
  const next = control.kind === "set-variable" ? control.value
    : control.kind === "toggle-variable" ? (current > variable.min ? variable.min : variable.max)
    : current + control.direction * variable.step;
  if (next === current || next < variable.min - 1e-9 || next > variable.max + 1e-9) return null;
  return { type: "set-variable", variableId: control.variableId, value: next };
}

/** Whether a set-variable control currently shows the selected value (for pressed/selected state). */
export function controlSelected(state: FidelityState, control: SceneControl): boolean {
  // A toggle is "selected" while on (R3 interaction P1: the hospital chip announced "not pressed" while lit).
  if (control.kind === "toggle-variable") return state.variables[control.variableId] === 1;
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
    if (control.kind === "drag-variable") {
      const [from, to] = control.worldRange;
      if (variable.kind === "toggle" || !Number.isFinite(from) || !Number.isFinite(to) || from === to) errors.push(`control_drag_invalid:${component.id}`);
      if (control.confirm) errors.push(`control_drag_confirm:${component.id}`);
    }
  }
  return errors;
}

/** A row of related in-scene controls (e.g. the five season bands) drawn as one chip group at their mean position. */
export type ControlGroupLayout<T extends { id: string; center: [number, number, number]; control?: { label: string } }> = { key: string; anchor: [number, number, number]; items: T[] };

/** Group control items by their declared group (default: the variable) so chips never stack on each other. */
export function layoutControlGroups<T extends { id: string; center: [number, number, number]; control?: { label: string; group?: string; variableId?: string } }>(items: readonly T[]): ControlGroupLayout<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.control) continue;
    const key = item.control.group ?? item.control.variableId ?? item.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([key, members]) => ({
    key,
    anchor: [0, 1, 2].map((axis) => members.reduce((sum, member) => sum + member.center[axis], 0) / members.length) as [number, number, number],
    items: members,
  }));
}

/**
 * A14 drag control: the variable value at parameter `t` (0 at worldRange[0], 1 at worldRange[1]), snapped to the
 * variable's step grid and held inside its bounds.
 */
export function dragValue(spec: HighFidelitySpec, control: Extract<SceneControl, { kind: "drag-variable" }>, t: number): number | null {
  const variable = spec.variables.find((candidate) => candidate.id === control.variableId);
  if (!variable || !Number.isFinite(t)) return null;
  const clamped = Math.min(1, Math.max(0, t));
  const steps = Math.round((clamped * (variable.max - variable.min)) / variable.step);
  return Math.min(variable.max, Math.max(variable.min, Number((variable.min + steps * variable.step).toFixed(9))));
}

/** A14: a drag dispatches `set-variable` only when it crosses a step boundary (a new snapped value). */
export function dragAction(spec: HighFidelitySpec, state: FidelityState, control: SceneControl, t: number): Extract<FidelityAction, { type: "set-variable" }> | null {
  if (control.kind !== "drag-variable") return null;
  const value = dragValue(spec, control, t);
  const variable = spec.variables.find((candidate) => candidate.id === control.variableId);
  if (value === null || !variable) return null;
  const current = state.variables[control.variableId] ?? variable.initial;
  return Math.abs(value - current) < 1e-9 ? null : { type: "set-variable", variableId: control.variableId, value };
}

/** A14: the drag parameter of a pointer projected onto the screen segment from `start` (t = 0) to `end` (t = 1). */
export function dragParameter(start: { x: number; y: number }, end: { x: number; y: number }, pointer: { x: number; y: number }): number {
  const dx = end.x - start.x, dy = end.y - start.y, length = dx * dx + dy * dy;
  if (length < 1e-6) return 0;
  return Math.min(1, Math.max(0, ((pointer.x - start.x) * dx + (pointer.y - start.y) * dy) / length));
}

/** The world-space ends of a drag control's axis through the part's centre. */
export function dragAxisEnds(control: Extract<SceneControl, { kind: "drag-variable" }>, center: readonly [number, number, number]): [[number, number, number], [number, number, number]] {
  const axis = control.axis === "x" ? 0 : control.axis === "y" ? 1 : 2;
  const end = (value: number) => center.map((coordinate, index) => index === axis ? value : coordinate) as [number, number, number];
  return [end(control.worldRange[0]), end(control.worldRange[1])];
}

/**
 * A14 pending confirm, presentation only: it never reaches `acceptLabAction` and is never sent to the events route
 * (classified IGNORED). Escape, blur or Cancel clears it; there is no timer.
 */
export type PendingControl = { componentId: string; label: string; action: Extract<FidelityAction, { type: "set-variable" }> };

/**
 * One activation of a control part. A `confirm` control first returns a pending preview; activating the same pending
 * part again returns the action to dispatch. Any other control dispatches at once (and clears another pending part).
 */
export function activateControl(pending: PendingControl | null, componentId: string, control: SceneControl, action: Extract<FidelityAction, { type: "set-variable" }> | null): { pending: PendingControl | null; dispatch: Extract<FidelityAction, { type: "set-variable" }> | null } {
  if (!action) return { pending, dispatch: null };
  if (!control.confirm) return { pending: null, dispatch: action };
  if (pending?.componentId === componentId) return { pending: null, dispatch: pending.action };
  return { pending: { componentId, label: control.label, action }, dispatch: null };
}
