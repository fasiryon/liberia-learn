"use client";

import type { HumanHeartAction } from "@/lib/labs/human-heart/actions";
import type { HumanHeartState } from "@/lib/labs/human-heart/state";

function oxygenClass(oxygenLevel: number) {
  if (oxygenLevel > 90) return "bg-emerald-500";
  if (oxygenLevel >= 70) return "bg-yellow-400";
  return "bg-red-500";
}

export default function HumanHeartFallback({
  state,
  onAction,
}: {
  state: HumanHeartState;
  onAction: (action: HumanHeartAction) => void;
}) {
  return (
    <section className="bg-slate-950 p-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-950 px-4 py-5 text-center">
            <p className="text-4xl font-bold text-white">{Math.round(state.heartRate)}</p>
            <p className="mt-1 text-sm text-slate-400">BPM</p>
          </div>
          <div className="rounded-xl bg-slate-950 px-4 py-5 text-center">
            <div className={`mx-auto h-12 w-12 rounded-full ${oxygenClass(state.oxygenLevel)}`} />
            <p className="mt-3 text-lg font-semibold text-white">{state.oxygenLevel.toFixed(0)}%</p>
            <p className="text-sm text-slate-400">Oxygen</p>
          </div>
          <div className="rounded-xl bg-slate-950 px-4 py-5 text-center">
            <p className="text-3xl font-bold text-white">{state.cardiacOutput.toFixed(1)}</p>
            <p className="mt-1 text-sm text-slate-400">L/min</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-sm text-slate-100">
          Blockage status: {state.blockage ? "active" : "clear"}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })}
          className="min-h-11 rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950"
        >
          {state.paused ? "Play" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => onAction(state.blockage ? { type: "CLEAR_BLOCKAGE" } : { type: "SIMULATE_BLOCKAGE" })}
          className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
        >
          {state.blockage ? "Clear" : "Blockage"}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "RESET" })}
          className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
