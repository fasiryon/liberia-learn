"use client";

import type { TectonicPlatesAction } from "@/lib/labs/tectonic-plates/actions";
import type { TectonicPlatesState } from "@/lib/labs/tectonic-plates/state";

function riskClass(risk: TectonicPlatesState["earthquakeRisk"]) {
  if (risk === "critical") return "text-red-300";
  if (risk === "high") return "text-orange-300";
  if (risk === "medium") return "text-yellow-300";
  return "text-emerald-300";
}

export default function TectonicPlatesFallback({
  state,
  onAction,
}: {
  state: TectonicPlatesState;
  onAction: (action: TectonicPlatesAction) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-4 text-slate-100">
      <h3 className="text-lg font-semibold">Tectonic Plates Lab</h3>
      <div className={`rounded-lg border border-slate-800 bg-slate-900 p-4 text-center text-3xl font-bold uppercase ${riskClass(state.earthquakeRisk)}`}>
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
        <button type="button" onClick={() => onAction({ type: "TRIGGER_EARTHQUAKE" })} className="min-h-11 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950">
          Trigger Earthquake
        </button>
        <button type="button" onClick={() => onAction({ type: "TRIGGER_ERUPTION" })} className="min-h-11 rounded-full border border-slate-700 px-4 text-sm">
          Trigger Eruption
        </button>
      </div>
    </div>
  );
}
