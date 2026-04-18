import type { ElectricCircuitAction } from "@/lib/labs/electric-circuit/actions";
import {
  CIRCUIT_INITIAL_STATE,
  type ElectricCircuitState,
} from "@/lib/labs/electric-circuit/state";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function derive(state: Omit<ElectricCircuitState, "current" | "power" | "totalResistance">): ElectricCircuitState {
  const voltage = clamp(state.voltage, 0, 24);
  const resistance1 = clamp(state.resistance1, 1, 1000);
  const resistance2 = clamp(state.resistance2, 1, 1000);
  const circuitType = state.circuitType === "parallel" ? "parallel" : "series";
  const totalResistance =
    circuitType === "series"
      ? resistance1 + resistance2
      : (resistance1 * resistance2) / (resistance1 + resistance2);
  const current = voltage / totalResistance;

  return {
    voltage,
    resistance1,
    resistance2,
    circuitType,
    totalResistance,
    current,
    power: voltage * current,
    paused: Boolean(state.paused),
  };
}

function normalizeState(state: ElectricCircuitState): ElectricCircuitState {
  return derive(state);
}

export function applyElectricCircuitAction(
  state: ElectricCircuitState,
  action: ElectricCircuitAction
): ElectricCircuitState {
  const current = normalizeState(state);

  switch (action.type) {
    case "SET_VOLTAGE":
      return derive({ ...current, voltage: action.value });
    case "SET_RESISTANCE1":
      return derive({ ...current, resistance1: action.value });
    case "SET_RESISTANCE2":
      return derive({ ...current, resistance2: action.value });
    case "SET_CIRCUIT_TYPE":
      return derive({ ...current, circuitType: action.value });
    case "RESET":
      return { ...CIRCUIT_INITIAL_STATE };
  }
}

export function isElectricCircuitState(value: unknown): value is ElectricCircuitState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ElectricCircuitState>;
  return (
    typeof state.voltage === "number" &&
    typeof state.resistance1 === "number" &&
    typeof state.resistance2 === "number" &&
    (state.circuitType === "series" || state.circuitType === "parallel") &&
    typeof state.current === "number" &&
    typeof state.power === "number" &&
    typeof state.totalResistance === "number" &&
    typeof state.paused === "boolean"
  );
}
