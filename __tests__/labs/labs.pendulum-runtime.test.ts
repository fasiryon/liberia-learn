import { describe, expect, it } from "vitest";

import { applyPendulumLabAction } from "@/lib/labs/pendulum-lab/runtime";
import {
  PENDULUM_INITIAL_STATE,
  type PendulumLabState,
} from "@/lib/labs/pendulum-lab/state";

describe("pendulum lab runtime", () => {
  it("SET_LENGTH clamps at 0.1 and 5", () => {
    expect(
      applyPendulumLabAction(PENDULUM_INITIAL_STATE, { type: "SET_LENGTH", value: -1 }).length
    ).toBe(0.1);
    expect(
      applyPendulumLabAction(PENDULUM_INITIAL_STATE, { type: "SET_LENGTH", value: 6 }).length
    ).toBe(5);
  });

  it("SET_ANGLE clamps at -90 and 90", () => {
    expect(
      applyPendulumLabAction(PENDULUM_INITIAL_STATE, { type: "SET_ANGLE", value: -100 }).angle
    ).toBe(-90);
    expect(
      applyPendulumLabAction(PENDULUM_INITIAL_STATE, { type: "SET_ANGLE", value: 100 }).angle
    ).toBe(90);
  });

  it("SET_ANGLE resets angularVelocity to 0", () => {
    const state: PendulumLabState = {
      ...PENDULUM_INITIAL_STATE,
      angularVelocity: 2,
      time: 5,
    };

    const next = applyPendulumLabAction(state, { type: "SET_ANGLE", value: 20 });
    expect(next.angularVelocity).toBe(0);
    expect(next.time).toBe(0);
  });

  it("STEP advances angle and time correctly", () => {
    const state: PendulumLabState = {
      ...PENDULUM_INITIAL_STATE,
      length: 1,
      angle: 30,
      angularVelocity: 0,
      damping: 0,
      time: 0,
    };

    const next = applyPendulumLabAction(state, { type: "STEP", dt: 0.1 });
    const acceleration = -(9.81 / 1) * Math.sin(30 * (Math.PI / 180));
    const expectedVelocity = acceleration * 0.1;
    const expectedAngle = 30 + expectedVelocity * 0.1 * (180 / Math.PI);

    expect(next.angularVelocity).toBeCloseTo(expectedVelocity, 6);
    expect(next.angle).toBeCloseTo(expectedAngle, 6);
    expect(next.time).toBeCloseTo(0.1, 6);
  });

  it("RESET returns exact PENDULUM_INITIAL_STATE", () => {
    const next = applyPendulumLabAction(
      { ...PENDULUM_INITIAL_STATE, length: 4, angle: -45, paused: false },
      { type: "RESET" }
    );

    expect(next).toEqual(PENDULUM_INITIAL_STATE);
  });

  it("damping reduces angular velocity over time", () => {
    const undamped = applyPendulumLabAction(
      { ...PENDULUM_INITIAL_STATE, angle: 0, angularVelocity: 3, damping: 0 },
      { type: "STEP", dt: 0.1 }
    );
    const damped = applyPendulumLabAction(
      { ...PENDULUM_INITIAL_STATE, angle: 0, angularVelocity: 3, damping: 0.5 },
      { type: "STEP", dt: 0.1 }
    );

    expect(Math.abs(damped.angularVelocity)).toBeLessThan(Math.abs(undamped.angularVelocity));
  });
});
