import type { GravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import {
  GRAVITY_INITIAL_STATE,
  type GravityLabState,
} from "@/lib/labs/gravity-explorer/state";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampState(state: GravityLabState): GravityLabState {
  return {
    gravity: clamp(state.gravity, 0, 30),
    mass: clamp(state.mass, 0.1, 100),
    height: clamp(state.height, 0, 100),
    velocity: Math.max(0, Number.isFinite(state.velocity) ? state.velocity : 0),
    time: Math.max(0, Number.isFinite(state.time) ? state.time : 0),
    paused: Boolean(state.paused),
  };
}

export function applyGravityLabAction(
  state: GravityLabState,
  action: GravityLabAction
): GravityLabState {
  const current = clampState(state);

  switch (action.type) {
    case "SET_GRAVITY":
      return { ...current, gravity: clamp(action.value, 0, 30) };
    case "SET_MASS":
      return { ...current, mass: clamp(action.value, 0.1, 100) };
    case "SET_HEIGHT":
      return {
        ...current,
        height: clamp(action.value, 0, 100),
        velocity: 0,
        time: 0,
      };
    case "PLAY":
      return { ...current, paused: false };
    case "PAUSE":
      return { ...current, paused: true };
    case "RESET":
      return { ...GRAVITY_INITIAL_STATE };
    case "STEP": {
      const dt = clamp(action.dt ?? 0.1, 0.01, 1);

      if (current.height <= 0) {
        return { ...current, paused: true, height: 0 };
      }

      const newVelocity = current.velocity + current.gravity * dt;
      const newHeight = Math.max(0, current.height - newVelocity * dt);
      const hitGround = newHeight <= 0;

      return {
        ...current,
        velocity: hitGround ? 0 : newVelocity,
        height: hitGround ? 0 : newHeight,
        time: current.time + dt,
        paused: hitGround ? true : current.paused,
      };
    }
  }
}

export function isGravityLabState(value: unknown): value is GravityLabState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GravityLabState>;
  return (
    typeof state.gravity === "number" &&
    typeof state.mass === "number" &&
    typeof state.height === "number" &&
    typeof state.velocity === "number" &&
    typeof state.time === "number" &&
    typeof state.paused === "boolean"
  );
}
