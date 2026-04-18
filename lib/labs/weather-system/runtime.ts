import type { LabAction } from "@/lib/labs/types";
import type { WeatherSystemAction } from "@/lib/labs/weather-system/actions";
import {
  WEATHER_INITIAL_STATE,
  type PrecipitationType,
  type WeatherSystemState,
} from "@/lib/labs/weather-system/state";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateCloudCover(humidity: number, pressure: number): number {
  let base = humidity * 0.8;
  if (pressure < 1000) base += (1000 - pressure) * 0.5;
  return clamp(base, 0, 100);
}

export function calculatePrecipitation(
  temperature: number,
  humidity: number,
  pressure: number
): PrecipitationType {
  if (temperature <= 0 && humidity > 60) return "snow";
  if (pressure < 990 && humidity > 70) return "storm";
  if (humidity > 80 && temperature > 0 && pressure < 1010) return "rain";
  return "none";
}

function withDerived(state: WeatherSystemState): WeatherSystemState {
  const cloudCover = calculateCloudCover(state.humidity, state.pressure);
  return {
    ...state,
    cloudCover,
    precipitation: calculatePrecipitation(state.temperature, state.humidity, state.pressure),
  };
}

export function applyWeatherSystemAction(
  state: WeatherSystemState,
  action: WeatherSystemAction
): WeatherSystemState {
  switch (action.type) {
    case "SET_TEMPERATURE":
      return withDerived({ ...state, temperature: clamp(action.value, -20, 50) });
    case "SET_HUMIDITY":
      return withDerived({ ...state, humidity: clamp(action.value, 0, 100) });
    case "SET_PRESSURE":
      return withDerived({ ...state, pressure: clamp(action.value, 950, 1050) });
    case "SET_WIND_SPEED":
      return withDerived({ ...state, windSpeed: clamp(action.value, 0, 150) });
    case "SET_SEASON": {
      const humidity =
        action.value === "wet"
          ? clamp(state.humidity + 20, 0, 100)
          : clamp(state.humidity - 20, 0, 100);
      return withDerived({ ...state, season: action.value, humidity });
    }
    case "SIMULATE_STORM":
      return withDerived({ ...state, pressure: 985, humidity: 90 });
    case "PLAY":
      return { ...state, paused: false };
    case "PAUSE":
      return { ...state, paused: true };
    case "STEP":
      return { ...state, time: state.time + 0.1 };
    case "RESET":
      return WEATHER_INITIAL_STATE;
    default:
      return state;
  }
}

export function isWeatherSystemState(state: unknown): state is WeatherSystemState {
  return (
    Boolean(state) &&
    typeof state === "object" &&
    typeof (state as WeatherSystemState).temperature === "number" &&
    typeof (state as WeatherSystemState).humidity === "number" &&
    typeof (state as WeatherSystemState).pressure === "number" &&
    typeof (state as WeatherSystemState).windSpeed === "number" &&
    typeof (state as WeatherSystemState).cloudCover === "number" &&
    typeof (state as WeatherSystemState).precipitation === "string"
  );
}

export function applyWeatherSystemLabAction(
  state: WeatherSystemState,
  action: LabAction
): WeatherSystemState {
  return applyWeatherSystemAction(state, action as WeatherSystemAction);
}
