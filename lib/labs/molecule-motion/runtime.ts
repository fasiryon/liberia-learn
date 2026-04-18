import type { MoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import {
  MOLECULE_INITIAL_STATE,
  type MoleculeMotionState,
} from "@/lib/labs/molecule-motion/state";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function getPhase(temp: number): MoleculeMotionState["phase"] {
  if (temp < 100) return "solid";
  if (temp < 373) return "liquid";
  return "gas";
}

function pressureFor(particleCount: number, temperature: number): number {
  return (particleCount * temperature) / 1000;
}

function normalizeState(state: MoleculeMotionState): MoleculeMotionState {
  const temperature = clamp(state.temperature, 0, 1000);
  const particleCount = Math.round(clamp(state.particleCount, 10, 200));
  return {
    temperature,
    particleCount,
    pressure: pressureFor(particleCount, temperature),
    phase: getPhase(temperature),
    paused: Boolean(state.paused),
    time: Math.max(0, Number.isFinite(state.time) ? state.time : 0),
  };
}

export function applyMoleculeMotionAction(
  state: MoleculeMotionState,
  action: MoleculeMotionAction
): MoleculeMotionState {
  const current = normalizeState(state);

  switch (action.type) {
    case "SET_TEMPERATURE": {
      const temperature = clamp(action.value, 0, 1000);
      return {
        ...current,
        temperature,
        pressure: pressureFor(current.particleCount, temperature),
        phase: getPhase(temperature),
      };
    }
    case "SET_PARTICLE_COUNT": {
      const particleCount = Math.round(clamp(action.value, 10, 200));
      return {
        ...current,
        particleCount,
        pressure: pressureFor(particleCount, current.temperature),
      };
    }
    case "PLAY":
      return { ...current, paused: false };
    case "PAUSE":
      return { ...current, paused: true };
    case "RESET":
      return { ...MOLECULE_INITIAL_STATE };
    case "STEP": {
      const dt = clamp(action.dt ?? 0.1, 0.001, 1);
      return { ...current, time: current.time + dt };
    }
  }
}

export function isMoleculeMotionState(value: unknown): value is MoleculeMotionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<MoleculeMotionState>;
  return (
    typeof state.temperature === "number" &&
    typeof state.particleCount === "number" &&
    typeof state.pressure === "number" &&
    (state.phase === "solid" || state.phase === "liquid" || state.phase === "gas") &&
    typeof state.paused === "boolean" &&
    typeof state.time === "number"
  );
}
