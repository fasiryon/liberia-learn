import type { LabAction } from "@/lib/labs/types";
import type { WeatherSeason } from "@/lib/labs/weather-system/state";

export type WeatherSystemAction =
  | { type: "SET_TEMPERATURE"; value: number }
  | { type: "SET_HUMIDITY"; value: number }
  | { type: "SET_PRESSURE"; value: number }
  | { type: "SET_WIND_SPEED"; value: number }
  | { type: "SET_SEASON"; value: WeatherSeason }
  | { type: "SIMULATE_STORM" }
  | { type: "RESET" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STEP" };

export const WEATHER_ACTION_TYPES = [
  "SET_TEMPERATURE",
  "SET_HUMIDITY",
  "SET_PRESSURE",
  "SET_WIND_SPEED",
  "SET_SEASON",
  "SIMULATE_STORM",
  "RESET",
  "PLAY",
  "PAUSE",
  "STEP",
] as const;

export function isWeatherSystemAction(action: LabAction): action is WeatherSystemAction {
  return (WEATHER_ACTION_TYPES as readonly string[]).includes(action.type);
}
