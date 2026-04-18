import { describe, expect, it } from "vitest";
import {
  applyTectonicPlatesAction,
  calculateEarthquakeRisk,
} from "@/lib/labs/tectonic-plates/runtime";
import { TECTONIC_INITIAL_STATE } from "@/lib/labs/tectonic-plates/state";

describe("tectonic plates runtime", () => {
  it("SET_PLATE1_SPEED clamps at 0 and 10", () => {
    expect(applyTectonicPlatesAction(TECTONIC_INITIAL_STATE, { type: "SET_PLATE1_SPEED", value: -1 }).plate1Speed).toBe(0);
    expect(applyTectonicPlatesAction(TECTONIC_INITIAL_STATE, { type: "SET_PLATE1_SPEED", value: 12 }).plate1Speed).toBe(10);
  });

  it("SET_PLATE2_SPEED clamps at 0 and 10", () => {
    expect(applyTectonicPlatesAction(TECTONIC_INITIAL_STATE, { type: "SET_PLATE2_SPEED", value: -1 }).plate2Speed).toBe(0);
    expect(applyTectonicPlatesAction(TECTONIC_INITIAL_STATE, { type: "SET_PLATE2_SPEED", value: 12 }).plate2Speed).toBe(10);
  });

  it("convergent pressure increases with combined speed", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, plate1Speed: 5, plate2Speed: 5, boundaryType: "convergent" },
      { type: "STEP" }
    );
    expect(state.pressure).toBeGreaterThan(0);
  });

  it("divergent pressure decreases", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, pressure: 20, boundaryType: "divergent" },
      { type: "STEP" }
    );
    expect(state.pressure).toBeLessThan(20);
  });

  it("transform pressure increases with speed difference", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, plate1Speed: 10, plate2Speed: 2, boundaryType: "transform" },
      { type: "STEP" }
    );
    expect(state.pressure).toBeGreaterThan(0);
  });

  it("pressure > 85 triggers auto-event when random chance passes", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, pressure: 86, boundaryType: "transform" },
      { type: "STEP" },
      () => 0
    );
    expect(state.lastEvent).toBe("earthquake");
    expect(state.pressure).toBe(20);
    expect(state.eventTimer).toBe(60);
  });

  it("TRIGGER_EARTHQUAKE resets pressure to 20", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, pressure: 90 },
      { type: "TRIGGER_EARTHQUAKE" }
    );
    expect(state.lastEvent).toBe("earthquake");
    expect(state.pressure).toBe(20);
  });

  it("TRIGGER_ERUPTION resets pressure to 25", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, pressure: 90 },
      { type: "TRIGGER_ERUPTION" }
    );
    expect(state.lastEvent).toBe("eruption");
    expect(state.pressure).toBe(25);
  });

  it("SET_BOUNDARY_TYPE resets pressure to 0", () => {
    const state = applyTectonicPlatesAction(
      { ...TECTONIC_INITIAL_STATE, pressure: 70, lastEvent: "earthquake", eventTimer: 20 },
      { type: "SET_BOUNDARY_TYPE", value: "divergent" }
    );
    expect(state.boundaryType).toBe("divergent");
    expect(state.pressure).toBe(0);
    expect(state.lastEvent).toBe("none");
  });

  it("earthquakeRisk thresholds are correct at 30, 60, and 85", () => {
    expect(calculateEarthquakeRisk(29.9)).toBe("low");
    expect(calculateEarthquakeRisk(30)).toBe("medium");
    expect(calculateEarthquakeRisk(59.9)).toBe("medium");
    expect(calculateEarthquakeRisk(60)).toBe("high");
    expect(calculateEarthquakeRisk(85)).toBe("high");
    expect(calculateEarthquakeRisk(85.1)).toBe("critical");
  });

  it("RESET returns exact TECTONIC_INITIAL_STATE", () => {
    expect(
      applyTectonicPlatesAction(
        { ...TECTONIC_INITIAL_STATE, pressure: 90, lastEvent: "eruption", eventTimer: 30 },
        { type: "RESET" }
      )
    ).toEqual(TECTONIC_INITIAL_STATE);
  });
});
