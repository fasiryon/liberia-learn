"use client";

import type { EcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import type { EcosystemBalanceState } from "@/lib/labs/ecosystem-balance/state";

function Bar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm text-slate-100">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-2 h-4 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${className}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function EcosystemBalanceFallback({
  state,
  onAction,
}: {
  state: EcosystemBalanceState;
  onAction: (action: EcosystemBalanceAction) => void;
}) {
  return (
    <section className="bg-slate-950 p-4 text-slate-100">
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-white">Ecosystem Balance</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.droughtActive ? "bg-amber-400 text-slate-950" : "bg-emerald-500/20 text-emerald-100"}`}>
            {state.droughtActive ? "Drought active" : "Normal rainfall"}
          </span>
        </div>
        <Bar label="Plants" value={state.plantCount} max={1000} className="bg-green-400" />
        <Bar label="Herbivores" value={state.herbivoreCount} max={500} className="bg-yellow-300" />
        <Bar label="Carnivores" value={state.carnivoreCount} max={200} className="bg-red-500" />
      </div>
      <button type="button" onClick={() => onAction(state.droughtActive ? { type: "REMOVE_DROUGHT" } : { type: "ADD_DROUGHT" })} className="mt-3 min-h-11 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
        {state.droughtActive ? "Remove Drought" : "Simulate Drought"}
      </button>
    </section>
  );
}
