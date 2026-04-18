import type { PendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import {
  PENDULUM_INITIAL_STATE,
  type PendulumLabState,
} from "@/lib/labs/pendulum-lab/state";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampState(state: PendulumLabState): PendulumLabState {
  return {
    length: clamp(state.length, 0.1, 5),
    angle: clamp(state.angle, -90, 90),
    angularVelocity: Number.isFinite(state.angularVelocity) ? state.angularVelocity : 0,
    damping: clamp(state.damping, 0, 1),
    time: Math.max(0, Number.isFinite(state.time) ? state.time : 0),
    paused: Boolean(state.paused),
  };
}

export function applyPendulumLabAction(
  state: PendulumLabState,
  action: PendulumLabAction
): PendulumLabState {
  const current = clampState(state);

  switch (action.type) {
    case "SET_LENGTH":
      return { ...current, length: clamp(action.value, 0.1, 5) };
    case "SET_ANGLE":
      return {
        ...current,
        angle: clamp(action.value, -90, 90),
        angularVelocity: 0,
        time: 0,
      };
    case "SET_DAMPING":
      return { ...current, damping: clamp(action.value, 0, 1) };
    case "PLAY":
      return { ...current, paused: false };
    case "PAUSE":
      return { ...current, paused: true };
    case "RESET":
      return { ...PENDULUM_INITIAL_STATE };
    case "STEP": {
      const dt = clamp(action.dt ?? 0.05, 0.001, 0.5);
      const angleRad = current.angle * (Math.PI / 180);
      const angularAcceleration = -(9.81 / current.length) * Math.sin(angleRad);
      const newAngularVelocity =
        (current.angularVelocity + angularAcceleration * dt) *
        (1 - current.damping * dt);
      const newAngleDeg = clamp(
        current.angle + newAngularVelocity * dt * (180 / Math.PI),
        -90,
        90
      );

      return {
        ...current,
        angle: newAngleDeg,
        angularVelocity: newAngularVelocity,
        time: current.time + dt,
      };
    }
  }
}

export function isPendulumLabState(value: unknown): value is PendulumLabState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PendulumLabState>;
  return (
    typeof state.length === "number" &&
    typeof state.angle === "number" &&
    typeof state.angularVelocity === "number" &&
    typeof state.damping === "number" &&
    typeof state.time === "number" &&
    typeof state.paused === "boolean"
  );
}
