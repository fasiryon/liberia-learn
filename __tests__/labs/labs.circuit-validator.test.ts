import { describe, expect, it } from "vitest";
import { validateElectricCircuitAction } from "@/lib/labs/electric-circuit/validator";

describe("electric circuit validator", () => {
  it("returns ok false for values outside bounds", () => {
    expect(validateElectricCircuitAction({ type: "SET_VOLTAGE", value: -1 }).ok).toBe(false);
    expect(validateElectricCircuitAction({ type: "SET_VOLTAGE", value: 25 }).ok).toBe(false);
    expect(validateElectricCircuitAction({ type: "SET_RESISTANCE1", value: 0 }).ok).toBe(false);
    expect(validateElectricCircuitAction({ type: "SET_RESISTANCE2", value: 1001 }).ok).toBe(false);
  });

  it("returns ok false for invalid circuit type", () => {
    expect(
      validateElectricCircuitAction({ type: "SET_CIRCUIT_TYPE", value: "grid" as any }).ok
    ).toBe(false);
  });

  it("RESET always returns ok true", () => {
    expect(validateElectricCircuitAction({ type: "RESET" }).ok).toBe(true);
  });
});
