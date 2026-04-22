"use client";

import type { TectonicPlatesAction } from "@/lib/labs/tectonic-plates/actions";
import type { TectonicPlatesState } from "@/lib/labs/tectonic-plates/state";

function riskClass(risk: TectonicPlatesState["earthquakeRisk"]) {
  if (risk === "critical") return "text-red-300";
  if (risk === "high") return "text-orange-300";
  if (risk === "medium") return "text-yellow-300";
  return "text-[var(--ll-yellow)]";
}

export default function TectonicPlatesFallback({
  state,
  onAction,
}: {
  state: TectonicPlatesState;
  onAction: (action: TectonicPlatesAction) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <h3 className="text-lg font-semibold">Tectonic Plates Lab</h3>
      <div className={`rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 text-center text-3xl font-bold uppercase ${riskClass(state.earthquakeRisk)}`}>
        {state.earthquakeRisk}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>Plate 1 speed: {state.plate1Speed} cm/yr</p>
        <p>Plate 2 speed: {state.plate2Speed} cm/yr</p>
        <p>Boundary: {state.boundaryType}</p>
        <p>Pressure: {state.pressure}</p>
        <p>Last event: {state.lastEvent}</p>
        <p>Time: {state.time.toFixed(1)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction({ type: "TRIGGER_EARTHQUAKE" })} className="min-h-11 rounded-full bg-[var(--ll-silver-soft)] px-4 text-sm font-semibold text-[var(--ll-text-faint)]">
          Trigger Earthquake
        </button>
        <button type="button" onClick={() => onAction({ type: "TRIGGER_ERUPTION" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm">
          Trigger Eruption
        </button>
      </div>
    </div>
  );
}
