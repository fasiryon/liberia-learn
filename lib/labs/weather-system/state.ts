export type PrecipitationType = "none" | "rain" | "storm" | "snow";
export type WeatherSeason = "wet" | "dry";

export type WeatherSystemState = {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  cloudCover: number;
  precipitation: PrecipitationType;
  season: WeatherSeason;
  paused: boolean;
  time: number;
};

export const WEATHER_INITIAL_STATE: WeatherSystemState = {
  temperature: 28,
  humidity: 65,
  pressure: 1013,
  windSpeed: 15,
  cloudCover: 40,
  precipitation: "none",
  season: "dry",
  paused: true,
  time: 0,
};
