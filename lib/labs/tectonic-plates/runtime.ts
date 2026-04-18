import type { LabAction } from "@/lib/labs/types";
import type { TectonicPlatesAction } from "@/lib/labs/tectonic-plates/actions";
import {
  TECTONIC_INITIAL_STATE,
  type EarthquakeRisk,
  type TectonicPlatesState,
} from "@/lib/labs/tectonic-plates/state";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateEarthquakeRisk(pressure: number): EarthquakeRisk {
  if (pressure < 30) return "low";
  if (pressure < 60) return "medium";
  if (pressure <= 85) return "high";
  return "critical";
}

function withRisk(state: TectonicPlatesState): TectonicPlatesState {
  return { ...state, earthquakeRisk: calculateEarthquakeRisk(state.pressure) };
}

function stepTectonics(
  state: TectonicPlatesState,
  random: () => number = Math.random
): TectonicPlatesState {
  const dt = 0.1;
  const pressureIncrease =
    state.boundaryType === "convergent"
      ? (state.plate1Speed + state.plate2Speed) * 0.08 * dt
      : state.boundaryType === "transform"
        ? Math.abs(state.plate1Speed - state.plate2Speed) * 0.12 * dt
        : -(state.plate1Speed + state.plate2Speed) * 0.03 * dt;

  let pressure = clamp(state.pressure + pressureIncrease, 0, 100);
  let lastEvent = state.lastEvent;
  let eventTimer = state.eventTimer;

  if (pressure > 85 && random() < 0.02) {
    if (state.boundaryType === "transform") {
      lastEvent = "earthquake";
      pressure = 20;
    } else {
      lastEvent = "eruption";
      pressure = state.boundaryType === "convergent" ? 25 : 15;
    }
    eventTimer = 60;
  } else if (eventTimer > 0) {
    eventTimer -= 1;
  } else {
    lastEvent = "none";
  }

  return withRisk({
    ...state,
    pressure,
    lastEvent,
    eventTimer,
    time: state.time + dt,
  });
}

export function applyTectonicPlatesAction(
  state: TectonicPlatesState,
  action: TectonicPlatesAction,
  random?: () => number
): TectonicPlatesState {
  switch (action.type) {
    case "SET_PLATE1_SPEED":
      return { ...state, plate1Speed: clamp(action.value, 0, 10) };
    case "SET_PLATE2_SPEED":
      return { ...state, plate2Speed: clamp(action.value, 0, 10) };
    case "SET_BOUNDARY_TYPE":
      return withRisk({ ...state, boundaryType: action.value, pressure: 0, lastEvent: "none", eventTimer: 0 });
    case "TRIGGER_EARTHQUAKE":
      return withRisk({ ...state, lastEvent: "earthquake", pressure: 20, eventTimer: 60 });
    case "TRIGGER_ERUPTION":
      return withRisk({ ...state, lastEvent: "eruption", pressure: 25, eventTimer: 60 });
    case "PLAY":
      return { ...state, paused: false };
    case "PAUSE":
      return { ...state, paused: true };
    case "STEP":
      return stepTectonics(state, random);
    case "RESET":
      return TECTONIC_INITIAL_STATE;
    default:
      return state;
  }
}

export function isTectonicPlatesState(state: unknown): state is TectonicPlatesState {
  return (
    Boolean(state) &&
    typeof state === "object" &&
    typeof (state as TectonicPlatesState).plate1Speed === "number" &&
    typeof (state as TectonicPlatesState).plate2Speed === "number" &&
    typeof (state as TectonicPlatesState).boundaryType === "string" &&
    typeof (state as TectonicPlatesState).pressure === "number" &&
    typeof (state as TectonicPlatesState).earthquakeRisk === "string"
  );
}

export function applyTectonicPlatesLabAction(
  state: TectonicPlatesState,
  action: LabAction
): TectonicPlatesState {
  return applyTectonicPlatesAction(state, action as TectonicPlatesAction);
}
