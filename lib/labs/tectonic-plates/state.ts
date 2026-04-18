export type BoundaryType = "convergent" | "divergent" | "transform";
export type EarthquakeRisk = "low" | "medium" | "high" | "critical";
export type TectonicEvent = "none" | "earthquake" | "eruption";

export type TectonicPlatesState = {
  plate1Speed: number;
  plate2Speed: number;
  boundaryType: BoundaryType;
  pressure: number;
  earthquakeRisk: EarthquakeRisk;
  lastEvent: TectonicEvent;
  eventTimer: number;
  time: number;
  paused: boolean;
};

export const TECTONIC_INITIAL_STATE: TectonicPlatesState = {
  plate1Speed: 3,
  plate2Speed: 3,
  boundaryType: "convergent",
  pressure: 0,
  earthquakeRisk: "low",
  lastEvent: "none",
  eventTimer: 0,
  time: 0,
  paused: true,
};
