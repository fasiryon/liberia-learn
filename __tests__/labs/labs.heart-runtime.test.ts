import { describe, expect, it } from "vitest";

import { applyHumanHeartAction } from "@/lib/labs/human-heart/runtime";
import { HEART_INITIAL_STATE } from "@/lib/labs/human-heart/state";

describe("human heart runtime", () => {
  it("SET_HEART_RATE clamps at 20 and 200", () => {
    expect(
      applyHumanHeartAction(HEART_INITIAL_STATE, { type: "SET_HEART_RATE", value: 10 }).heartRate
    ).toBe(20);
    expect(
      applyHumanHeartAction(HEART_INITIAL_STATE, { type: "SET_HEART_RATE", value: 250 }).heartRate
    ).toBe(200);
  });

  it("SET_EXERCISE_LEVEL clamps at 0 and 3", () => {
    expect(
      applyHumanHeartAction(HEART_INITIAL_STATE, {
        type: "SET_EXERCISE_LEVEL",
        value: -1,
      }).exerciseLevel
    ).toBe(0);
    expect(
      applyHumanHeartAction(HEART_INITIAL_STATE, {
        type: "SET_EXERCISE_LEVEL",
        value: 4,
      }).exerciseLevel
    ).toBe(3);
  });

  it("SIMULATE_BLOCKAGE reduces oxygenLevel by 15", () => {
    const next = applyHumanHeartAction(HEART_INITIAL_STATE, { type: "SIMULATE_BLOCKAGE" });

    expect(next.blockage).toBe(true);
    expect(next.oxygenLevel).toBe(83);
  });

  it("CLEAR_BLOCKAGE increases oxygenLevel by 15", () => {
    const next = applyHumanHeartAction(
      { ...HEART_INITIAL_STATE, oxygenLevel: 80, blockage: true },
      { type: "CLEAR_BLOCKAGE" }
    );

    expect(next.blockage).toBe(false);
    expect(next.oxygenLevel).toBe(95);
  });

  it("oxygenLevel never goes below 0 or above 100", () => {
    const low = applyHumanHeartAction(
      { ...HEART_INITIAL_STATE, oxygenLevel: -20, blockage: true, paused: false },
      { type: "STEP", dt: 1 }
    );
    const high = applyHumanHeartAction(
      { ...HEART_INITIAL_STATE, oxygenLevel: 150, paused: false },
      { type: "STEP", dt: 1 }
    );

    expect(low.oxygenLevel).toBeGreaterThanOrEqual(0);
    expect(high.oxygenLevel).toBeLessThanOrEqual(100);
  });

  it("cardiacOutput recalculates correctly", () => {
    const next = applyHumanHeartAction(
      { ...HEART_INITIAL_STATE, strokeVolume: 80 },
      { type: "SET_HEART_RATE", value: 100 }
    );

    expect(next.cardiacOutput).toBe(8);
  });

  it("RESET returns exact HEART_INITIAL_STATE", () => {
    const next = applyHumanHeartAction(
      { ...HEART_INITIAL_STATE, heartRate: 180, oxygenLevel: 75, blockage: true },
      { type: "RESET" }
    );

    expect(next).toEqual(HEART_INITIAL_STATE);
  });

  it("PLAY and PAUSE update paused state", () => {
    expect(applyHumanHeartAction(HEART_INITIAL_STATE, { type: "PLAY" }).paused).toBe(false);
    expect(
      applyHumanHeartAction({ ...HEART_INITIAL_STATE, paused: false }, { type: "PAUSE" }).paused
    ).toBe(true);
  });
});
