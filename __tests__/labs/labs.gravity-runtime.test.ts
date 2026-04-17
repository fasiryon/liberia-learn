import { describe, expect, it } from "vitest";
import type { GravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import {
  GRAVITY_INITIAL_STATE,
  type GravityLabState,
} from "@/lib/labs/gravity-explorer/state";

function expectValidState(state: GravityLabState) {
  expect(state.gravity).toBeGreaterThanOrEqual(0);
  expect(state.gravity).toBeLessThanOrEqual(30);
  expect(state.mass).toBeGreaterThanOrEqual(0.1);
  expect(state.mass).toBeLessThanOrEqual(100);
  expect(state.height).toBeGreaterThanOrEqual(0);
  expect(state.height).toBeLessThanOrEqual(100);
  expect(state.velocity).toBeGreaterThanOrEqual(0);
  expect(state.time).toBeGreaterThanOrEqual(0);
  expect(typeof state.paused).toBe("boolean");
}

describe("gravity explorer runtime", () => {
  it("SET_GRAVITY clamps at 0 and 30", () => {
    expect(applyGravityLabAction(GRAVITY_INITIAL_STATE, { type: "SET_GRAVITY", value: -5 }).gravity).toBe(0);
    expect(applyGravityLabAction(GRAVITY_INITIAL_STATE, { type: "SET_GRAVITY", value: 35 }).gravity).toBe(30);
  });

  it("SET_MASS clamps at 0.1 and 100", () => {
    expect(applyGravityLabAction(GRAVITY_INITIAL_STATE, { type: "SET_MASS", value: 0 }).mass).toBe(0.1);
    expect(applyGravityLabAction(GRAVITY_INITIAL_STATE, { type: "SET_MASS", value: 101 }).mass).toBe(100);
  });

  it("SET_HEIGHT resets velocity to 0 and time to 0", () => {
    const state = applyGravityLabAction(
      { ...GRAVITY_INITIAL_STATE, velocity: 12, time: 4 },
      { type: "SET_HEIGHT", value: 80 }
    );
    expect(state.height).toBe(80);
    expect(state.velocity).toBe(0);
    expect(state.time).toBe(0);
  });

  it("STEP advances height and velocity correctly given known inputs", () => {
    const state = applyGravityLabAction(
      { ...GRAVITY_INITIAL_STATE, gravity: 10, height: 100, velocity: 0, time: 0, paused: false },
      { type: "STEP", dt: 0.5 }
    );
    expect(state.velocity).toBe(5);
    expect(state.height).toBe(97.5);
    expect(state.time).toBe(0.5);
    expect(state.paused).toBe(false);
  });

  it("STEP stops correctly at height 0 and sets paused: true", () => {
    const state = applyGravityLabAction(
      { ...GRAVITY_INITIAL_STATE, gravity: 30, height: 1, velocity: 20, paused: false },
      { type: "STEP", dt: 1 }
    );
    expect(state.height).toBe(0);
    expect(state.velocity).toBe(0);
    expect(state.paused).toBe(true);
  });

  it("STEP does not go below height 0", () => {
    const state = applyGravityLabAction(
      { ...GRAVITY_INITIAL_STATE, height: 0, velocity: 10, paused: false },
      { type: "STEP", dt: 0.5 }
    );
    expect(state.height).toBe(0);
    expect(state.paused).toBe(true);
  });

  it("RESET returns exact GRAVITY_INITIAL_STATE", () => {
    expect(
      applyGravityLabAction(
        { gravity: 30, mass: 99, height: 0, velocity: 12, time: 3, paused: false },
        { type: "RESET" }
      )
    ).toEqual(GRAVITY_INITIAL_STATE);
  });

  it("all 7 actions return valid GravityLabState", () => {
    const actions: GravityLabAction[] = [
      { type: "SET_GRAVITY", value: 12 },
      { type: "SET_MASS", value: 2 },
      { type: "SET_HEIGHT", value: 50 },
      { type: "RESET" },
      { type: "PLAY" },
      { type: "PAUSE" },
      { type: "STEP", dt: 0.1 },
    ];

    actions.forEach((action) => {
      expectValidState(applyGravityLabAction(GRAVITY_INITIAL_STATE, action));
    });
  });
});
