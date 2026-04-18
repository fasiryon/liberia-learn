"use client";

import type { WeatherSystemAction } from "@/lib/labs/weather-system/actions";
import type { WeatherSystemState } from "@/lib/labs/weather-system/state";

export default function WeatherSystemFallback({
  state,
  onAction,
}: {
  state: WeatherSystemState;
  onAction: (action: WeatherSystemAction) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-4 text-slate-100">
      <h3 className="text-lg font-semibold">Weather System Lab</h3>
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4 text-center text-3xl font-bold uppercase text-cyan-100">
        {state.precipitation}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>Temperature: {state.temperature} C</p>
        <p>Humidity: {state.humidity}%</p>
        <p>Pressure: {state.pressure} hPa</p>
        <p>Wind speed: {state.windSpeed} km/h</p>
        <p>Cloud cover: {state.cloudCover}%</p>
        <p>Season: {state.season}</p>
      </div>
      <button type="button" onClick={() => onAction({ type: "SIMULATE_STORM" })} className="min-h-11 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950">
        Simulate Storm
      </button>
    </div>
  );
}
