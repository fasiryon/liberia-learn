import { describe, expect, it } from "vitest";
import { validateWaveMotionAction } from "@/lib/labs/wave-motion/validator";

describe("wave motion validator", () => {
  it("returns ok false for invalid wave type", () => {
    expect(validateWaveMotionAction({ type: "SET_WAVE_TYPE", value: "surface" as any }).ok).toBe(false);
  });

  it("returns ok false for out of bounds values", () => {
    expect(validateWaveMotionAction({ type: "SET_FREQUENCY", value: 0 }).ok).toBe(false);
    expect(validateWaveMotionAction({ type: "SET_AMPLITUDE", value: 6 }).ok).toBe(false);
    expect(validateWaveMotionAction({ type: "SET_WAVE_SPEED", value: 30 }).ok).toBe(false);
  });
});
