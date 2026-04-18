import type { WaveMotionAction } from "@/lib/labs/wave-motion/actions";
import { WAVE_INITIAL_STATE, type WaveMotionState } from "@/lib/labs/wave-motion/state";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function derive(state: Omit<WaveMotionState, "wavelength">): WaveMotionState {
  const frequency = clamp(state.frequency, 0.1, 10);
  const amplitude = clamp(state.amplitude, 0.1, 5);
  const waveSpeed = clamp(state.waveSpeed, 1, 20);

  return {
    frequency,
    amplitude,
    waveSpeed,
    wavelength: waveSpeed / frequency,
    waveType: state.waveType === "longitudinal" ? "longitudinal" : "transverse",
    time: Math.max(0, Number.isFinite(state.time) ? state.time : 0),
    paused: Boolean(state.paused),
  };
}

function normalizeState(state: WaveMotionState): WaveMotionState {
  return derive(state);
}

export function applyWaveMotionAction(
  state: WaveMotionState,
  action: WaveMotionAction
): WaveMotionState {
  const current = normalizeState(state);

  switch (action.type) {
    case "SET_FREQUENCY":
      return derive({ ...current, frequency: action.value });
    case "SET_AMPLITUDE":
      return derive({ ...current, amplitude: action.value });
    case "SET_WAVE_SPEED":
      return derive({ ...current, waveSpeed: action.value });
    case "SET_WAVE_TYPE":
      return derive({ ...current, waveType: action.value });
    case "PLAY":
      return { ...current, paused: false };
    case "PAUSE":
      return { ...current, paused: true };
    case "RESET":
      return { ...WAVE_INITIAL_STATE };
    case "STEP": {
      const dt = clamp(action.dt ?? 0.016, 0.001, 0.1);
      return { ...current, time: current.time + dt };
    }
  }
}

export function isWaveMotionState(value: unknown): value is WaveMotionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WaveMotionState>;
  return (
    typeof state.frequency === "number" &&
    typeof state.amplitude === "number" &&
    typeof state.waveSpeed === "number" &&
    typeof state.wavelength === "number" &&
    (state.waveType === "transverse" || state.waveType === "longitudinal") &&
    typeof state.time === "number" &&
    typeof state.paused === "boolean"
  );
}
