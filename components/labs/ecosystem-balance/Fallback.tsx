"use client";

import type { EcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import type { EcosystemBalanceState } from "@/lib/labs/ecosystem-balance/state";

function Bar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm text-[var(--ll-text)]">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-2 h-4 overflow-hidden rounded-full bg-[var(--ll-surface)]">
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
    <section className="bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <div className="space-y-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-semibold text-[var(--ll-text)]">Ecosystem Balance</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.droughtActive ? "bg-[var(--ll-yellow-soft)] text-[var(--ll-text-faint)]" : "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"}`}>
            {state.droughtActive ? "Drought active" : "Normal rainfall"}
          </span>
        </div>
        <Bar label="Plants" value={state.plantCount} max={1000} className="bg-green-400" />
        <Bar label="Herbivores" value={state.herbivoreCount} max={500} className="bg-yellow-300" />
        <Bar label="Carnivores" value={state.carnivoreCount} max={200} className="bg-red-500" />
      </div>
      <button type="button" onClick={() => onAction(state.droughtActive ? { type: "REMOVE_DROUGHT" } : { type: "ADD_DROUGHT" })} className="mt-3 min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
        {state.droughtActive ? "Remove Drought" : "Simulate Drought"}
      </button>
    </section>
  );
}
