import { describe, expect, it } from "vitest";

import { applyMoleculeMotionAction } from "@/lib/labs/molecule-motion/runtime";
import { MOLECULE_INITIAL_STATE } from "@/lib/labs/molecule-motion/state";

describe("molecule motion runtime", () => {
  it("SET_TEMPERATURE clamps at 0 and 1000", () => {
    expect(
      applyMoleculeMotionAction(MOLECULE_INITIAL_STATE, {
        type: "SET_TEMPERATURE",
        value: -1,
      }).temperature
    ).toBe(0);
    expect(
      applyMoleculeMotionAction(MOLECULE_INITIAL_STATE, {
        type: "SET_TEMPERATURE",
        value: 1001,
      }).temperature
    ).toBe(1000);
  });

  it("temperature below 100 produces phase solid", () => {
    const next = applyMoleculeMotionAction(MOLECULE_INITIAL_STATE, {
      type: "SET_TEMPERATURE",
      value: 99,
    });

    expect(next.phase).toBe("solid");
  });

  it("temperature 100-372 produces phase liquid", () => {
    expect(
      applyMoleculeMotionAction(MOLECULE_INITIAL_STATE, {
        type: "SET_TEMPERATURE",
        value: 100,
      }).phase
    ).toBe("liquid");
    expect(
      applyMoleculeMotionAction(MOLECULE_INITIAL_STATE, {
        type: "SET_TEMPERATURE",
        value: 372,
      }).phase
    ).toBe("liquid");
  });

  it("temperature at or above 373 produces phase gas", () => {
    const next = applyMoleculeMotionAction(MOLECULE_INITIAL_STATE, {
      type: "SET_TEMPERATURE",
      value: 373,
    });

    expect(next.phase).toBe("gas");
  });

  it("pressure recalculates correctly on temperature change", () => {
    const next = applyMoleculeMotionAction(
      { ...MOLECULE_INITIAL_STATE, particleCount: 80 },
      { type: "SET_TEMPERATURE", value: 500 }
    );

    expect(next.pressure).toBe(40);
  });

  it("RESET returns exact MOLECULE_INITIAL_STATE", () => {
    const next = applyMoleculeMotionAction(
      { ...MOLECULE_INITIAL_STATE, temperature: 10, phase: "solid", pressure: 1 },
      { type: "RESET" }
    );

    expect(next).toEqual(MOLECULE_INITIAL_STATE);
  });
});
