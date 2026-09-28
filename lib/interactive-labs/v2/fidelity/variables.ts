import type { VariableDefinition } from "./types";

const EPSILON = 1e-9;

/** Invalid values are rejected, never silently clamped: a clamped value would record a state the learner did not choose. */
export function validateVariableValue(variable: VariableDefinition, value: unknown): { ok: true } | { ok: false; reason: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, reason: "variable_value_not_finite" };
  if (value < variable.min - EPSILON || value > variable.max + EPSILON) return { ok: false, reason: "variable_out_of_bounds" };
  if (variable.kind === "toggle" && value !== variable.min && value !== variable.max) return { ok: false, reason: "variable_toggle_invalid" };
  if (variable.kind === "discrete") {
    const steps = (value - variable.min) / variable.step;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) return { ok: false, reason: "variable_off_step" };
  }
  return { ok: true };
}

export function initialVariables(variables: readonly VariableDefinition[]): Record<string, number> {
  return Object.fromEntries(variables.map((variable) => [variable.id, variable.initial]));
}

/** Keyboard/button stepping for accessible control of any variable. */
export function stepVariable(variable: VariableDefinition, current: number, direction: 1 | -1): number {
  if (variable.kind === "toggle") return current === variable.max ? variable.min : variable.max;
  const next = Math.round((current + direction * variable.step) * 1e6) / 1e6;
  return Math.min(variable.max, Math.max(variable.min, next));
}

export function formatVariable(variable: VariableDefinition, value: number): string {
  if (variable.kind === "toggle") return value === variable.max ? "On" : "Off";
  const digits = Math.min(2, String(variable.step).split(".")[1]?.length ?? 0);
  return `${value.toFixed(digits)}${variable.unit ? ` ${variable.unit}` : ""}`;
}
