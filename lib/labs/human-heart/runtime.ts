import type { HumanHeartAction } from "@/lib/labs/human-heart/actions";
import { HEART_INITIAL_STATE, type HumanHeartState } from "@/lib/labs/human-heart/state";

type ExerciseProfile = {
  heartRate: number;
  strokeVolume: number;
};

const EXERCISE_PROFILES: Record<number, ExerciseProfile> = {
  0: { heartRate: 72, strokeVolume: 70 },
  1: { heartRate: 100, strokeVolume: 80 },
  2: { heartRate: 140, strokeVolume: 90 },
  3: { heartRate: 180, strokeVolume: 100 },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function cardiacOutputFor(heartRate: number, strokeVolume: number): number {
  return Number(((heartRate * strokeVolume) / 1000).toFixed(2));
}

function normalizeState(state: HumanHeartState): HumanHeartState {
  const exerciseLevel = Math.round(clamp(state.exerciseLevel, 0, 3));
  const heartRate = clamp(state.heartRate, 20, 200);
  const strokeVolume = clamp(state.strokeVolume, 40, 120);
  return {
    heartRate,
    oxygenLevel: clamp(state.oxygenLevel, 0, 100),
    exerciseLevel,
    blockage: Boolean(state.blockage),
    strokeVolume,
    cardiacOutput: cardiacOutputFor(heartRate, strokeVolume),
    paused: Boolean(state.paused),
    time: Math.max(0, Number.isFinite(state.time) ? state.time : 0),
  };
}

function oxygenForExercise(
  currentOxygen: number,
  exerciseLevel: number,
  blockage: boolean
): number {
  const exertionDrop = blockage ? exerciseLevel * 4 : exerciseLevel;
  return clamp(currentOxygen - exertionDrop, 0, 100);
}

export function applyHumanHeartAction(
  state: HumanHeartState,
  action: HumanHeartAction
): HumanHeartState {
  const current = normalizeState(state);

  switch (action.type) {
    case "SET_HEART_RATE": {
      const heartRate = clamp(action.value, 20, 200);
      return {
        ...current,
        heartRate,
        cardiacOutput: cardiacOutputFor(heartRate, current.strokeVolume),
      };
    }
    case "SET_EXERCISE_LEVEL": {
      const exerciseLevel = Math.round(clamp(action.value, 0, 3));
      const profile = EXERCISE_PROFILES[exerciseLevel];
      return {
        ...current,
        exerciseLevel,
        heartRate: profile.heartRate,
        strokeVolume: profile.strokeVolume,
        oxygenLevel: oxygenForExercise(current.oxygenLevel, exerciseLevel, current.blockage),
        cardiacOutput: cardiacOutputFor(profile.heartRate, profile.strokeVolume),
      };
    }
    case "SIMULATE_BLOCKAGE":
      return {
        ...current,
        blockage: true,
        oxygenLevel: Math.max(70, current.oxygenLevel - 15),
      };
    case "CLEAR_BLOCKAGE":
      return {
        ...current,
        blockage: false,
        oxygenLevel: Math.min(98, current.oxygenLevel + 15),
      };
    case "RESET":
      return { ...HEART_INITIAL_STATE };
    case "STEP": {
      const dt = clamp(action.dt ?? 0.1, 0.001, 1);
      if (current.paused) {
        return { ...current, time: current.time + dt };
      }

      const target = EXERCISE_PROFILES[current.exerciseLevel].heartRate;
      const direction = target >= current.heartRate ? 1 : -1;
      const variation = Math.min(Math.abs(target - current.heartRate), 2 * dt) * direction;
      const heartRate = clamp(current.heartRate + variation, 20, 200);
      const oxygenDrift = current.blockage ? -0.5 * dt : 0.2 * dt;

      return {
        ...current,
        heartRate,
        oxygenLevel: clamp(current.oxygenLevel + oxygenDrift, 0, 100),
        cardiacOutput: cardiacOutputFor(heartRate, current.strokeVolume),
        time: current.time + dt,
      };
    }
  }
}

export function isHumanHeartState(value: unknown): value is HumanHeartState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<HumanHeartState>;
  return (
    typeof state.heartRate === "number" &&
    typeof state.oxygenLevel === "number" &&
    typeof state.exerciseLevel === "number" &&
    typeof state.blockage === "boolean" &&
    typeof state.strokeVolume === "number" &&
    typeof state.cardiacOutput === "number" &&
    typeof state.paused === "boolean" &&
    typeof state.time === "number"
  );
}
