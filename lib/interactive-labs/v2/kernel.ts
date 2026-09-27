import type { InteractiveLabDefinition, LabAction, LabSessionCheckpoint } from "./types";

export function initializeLab<S>(definition: InteractiveLabDefinition<S>): S { return structuredClone(definition.initialState); }

export function acceptLabAction<S>(definition: InteractiveLabDefinition<S>, state: S, action: LabAction): { ok: true; state: S } | { ok: false; reason: string } {
  const result = definition.validateAction(state, action);
  if (!result.ok) return { ok: false, reason: result.reason ?? "Action is not allowed." };
  return { ok: true, state: definition.transition(state, action) };
}

export function checkpointSession(input: Omit<LabSessionCheckpoint, "updatedAt">): LabSessionCheckpoint {
  return { ...input, updatedAt: new Date().toISOString() };
}

export function restoreSession(raw: unknown, definition: InteractiveLabDefinition): LabSessionCheckpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<LabSessionCheckpoint>;
  if (value.labId !== definition.id || value.labVersion !== definition.version || !value.state || !Array.isArray(value.completedChecks)) return null;
  return value as LabSessionCheckpoint;
}
