import { describe, expect, it } from "vitest";
import {
  applyWeatherSystemAction,
  calculateCloudCover,
} from "@/lib/labs/weather-system/runtime";
import { WEATHER_INITIAL_STATE } from "@/lib/labs/weather-system/state";

describe("weather system runtime", () => {
  it("SET_TEMPERATURE clamps at -20 and 50", () => {
    expect(applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_TEMPERATURE", value: -30 }).temperature).toBe(-20);
    expect(applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_TEMPERATURE", value: 70 }).temperature).toBe(50);
  });

  it("SET_HUMIDITY clamps at 0 and 100", () => {
    expect(applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_HUMIDITY", value: -1 }).humidity).toBe(0);
    expect(applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_HUMIDITY", value: 120 }).humidity).toBe(100);
  });

  it("SET_PRESSURE clamps at 950 and 1050", () => {
    expect(applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_PRESSURE", value: 900 }).pressure).toBe(950);
    expect(applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_PRESSURE", value: 1100 }).pressure).toBe(1050);
  });

  it("humidity > 80, temp > 0, pressure < 1010 produces rain", () => {
    const state = applyWeatherSystemAction(
      { ...WEATHER_INITIAL_STATE, temperature: 24, humidity: 85 },
      { type: "SET_PRESSURE", value: 1005 }
    );
    expect(state.precipitation).toBe("rain");
  });

  it("temp <= 0 and humidity > 60 produces snow", () => {
    const state = applyWeatherSystemAction(
      { ...WEATHER_INITIAL_STATE, humidity: 70 },
      { type: "SET_TEMPERATURE", value: 0 }
    );
    expect(state.precipitation).toBe("snow");
  });

  it("pressure < 990 and humidity > 70 produces storm", () => {
    const state = applyWeatherSystemAction(
      { ...WEATHER_INITIAL_STATE, humidity: 90 },
      { type: "SET_PRESSURE", value: 985 }
    );
    expect(state.precipitation).toBe("storm");
  });

  it("SET_SEASON wet increases humidity and dry decreases humidity", () => {
    const wet = applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_SEASON", value: "wet" });
    expect(wet.humidity).toBe(85);
    const dry = applyWeatherSystemAction(wet, { type: "SET_SEASON", value: "dry" });
    expect(dry.humidity).toBe(65);
  });

  it("cloudCover derives correctly from humidity and pressure", () => {
    expect(calculateCloudCover(50, 1013)).toBe(40);
    expect(calculateCloudCover(80, 980)).toBe(74);
    const state = applyWeatherSystemAction(WEATHER_INITIAL_STATE, { type: "SET_HUMIDITY", value: 80 });
    expect(state.cloudCover).toBe(64);
  });

  it("RESET returns exact WEATHER_INITIAL_STATE", () => {
    expect(
      applyWeatherSystemAction(
        { ...WEATHER_INITIAL_STATE, humidity: 90, precipitation: "storm", time: 5 },
        { type: "RESET" }
      )
    ).toEqual(WEATHER_INITIAL_STATE);
  });
});
