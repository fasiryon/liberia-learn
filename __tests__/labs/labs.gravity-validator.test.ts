import { describe, expect, it } from "vitest";
import { validateGravityLabAction } from "@/lib/labs/gravity-explorer/validator";

describe("gravity explorer validator", () => {
  it("validates SET_GRAVITY bounds", () => {
    expect(validateGravityLabAction({ type: "SET_GRAVITY", value: -1 }).ok).toBe(false);
    expect(validateGravityLabAction({ type: "SET_GRAVITY", value: 31 }).ok).toBe(false);
    expect(validateGravityLabAction({ type: "SET_GRAVITY", value: 9.81 }).ok).toBe(true);
  });

  it("validates SET_MASS bounds", () => {
    expect(validateGravityLabAction({ type: "SET_MASS", value: 0 }).ok).toBe(false);
    expect(validateGravityLabAction({ type: "SET_MASS", value: 101 }).ok).toBe(false);
    expect(validateGravityLabAction({ type: "SET_MASS", value: 1 }).ok).toBe(true);
  });

  it("validates SET_HEIGHT bounds", () => {
    expect(validateGravityLabAction({ type: "SET_HEIGHT", value: -1 }).ok).toBe(false);
    expect(validateGravityLabAction({ type: "SET_HEIGHT", value: 101 }).ok).toBe(false);
    expect(validateGravityLabAction({ type: "SET_HEIGHT", value: 10 }).ok).toBe(true);
  });

  it("PLAY, PAUSE, RESET, STEP always return ok: true", () => {
    expect(validateGravityLabAction({ type: "PLAY" }).ok).toBe(true);
    expect(validateGravityLabAction({ type: "PAUSE" }).ok).toBe(true);
    expect(validateGravityLabAction({ type: "RESET" }).ok).toBe(true);
    expect(validateGravityLabAction({ type: "STEP" }).ok).toBe(true);
    expect(validateGravityLabAction({ type: "STEP", dt: 999 }).ok).toBe(true);
  });
});
