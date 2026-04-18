import { describe, expect, it } from "vitest";
import { applyWaveMotionAction } from "@/lib/labs/wave-motion/runtime";
import { WAVE_INITIAL_STATE } from "@/lib/labs/wave-motion/state";

describe("wave motion runtime", () => {
  it("recalculates wavelength as waveSpeed / frequency", () => {
    const state = applyWaveMotionAction(WAVE_INITIAL_STATE, {
      type: "SET_FREQUENCY",
      value: 4,
    });
    expect(state.wavelength).toBeCloseTo(state.waveSpeed / state.frequency);
  });

  it("SET_FREQUENCY clamps at 0.1 and 10", () => {
    expect(applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "SET_FREQUENCY", value: 0 }).frequency).toBe(0.1);
    expect(applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "SET_FREQUENCY", value: 11 }).frequency).toBe(10);
  });

  it("SET_AMPLITUDE clamps at 0.1 and 5", () => {
    expect(applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "SET_AMPLITUDE", value: 0 }).amplitude).toBe(0.1);
    expect(applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "SET_AMPLITUDE", value: 6 }).amplitude).toBe(5);
  });

  it("SET_WAVE_SPEED clamps at 1 and 20", () => {
    expect(applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "SET_WAVE_SPEED", value: 0 }).waveSpeed).toBe(1);
    expect(applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "SET_WAVE_SPEED", value: 30 }).waveSpeed).toBe(20);
  });

  it("STEP advances time", () => {
    const state = applyWaveMotionAction(WAVE_INITIAL_STATE, { type: "STEP", dt: 0.05 });
    expect(state.time).toBeCloseTo(0.05);
  });

  it("RESET returns exact WAVE_INITIAL_STATE", () => {
    expect(
      applyWaveMotionAction(
        { ...WAVE_INITIAL_STATE, frequency: 7, wavelength: 2, time: 4 },
        { type: "RESET" }
      )
    ).toEqual(WAVE_INITIAL_STATE);
  });
});
