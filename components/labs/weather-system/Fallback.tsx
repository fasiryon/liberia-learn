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
    <div className="space-y-4 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <h3 className="text-lg font-semibold">Weather System Lab</h3>
      <div className="rounded-lg border border-cyan-500/20 bg-[var(--ll-silver-soft)] p-4 text-center text-3xl font-bold uppercase text-[var(--ll-silver)]">
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
      <button type="button" onClick={() => onAction({ type: "SIMULATE_STORM" })} className="min-h-11 rounded-full bg-[var(--ll-silver-soft)] px-4 text-sm font-semibold text-[var(--ll-text-faint)]">
        Simulate Storm
      </button>
    </div>
  );
}
