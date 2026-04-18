"use client";

import type { MoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import type { MoleculeMotionState } from "@/lib/labs/molecule-motion/state";

function phaseColor(phase: MoleculeMotionState["phase"]) {
  if (phase === "solid") return "bg-blue-700";
  if (phase === "liquid") return "bg-teal-500";
  return "bg-orange-500";
}

export default function MoleculeMotionFallback({
  state,
  onAction,
}: {
  state: MoleculeMotionState;
  onAction: (action: MoleculeMotionAction) => void;
}) {
  return (
    <section className="bg-slate-950 p-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className={`flex h-44 items-center justify-center rounded-xl ${phaseColor(state.phase)} text-3xl font-bold uppercase text-white`}>
          {state.phase}
        </div>
        <dl className="mt-4 grid gap-2 text-sm text-slate-100 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-950 px-3 py-2">
            <dt className="text-slate-400">Temperature</dt>
            <dd className="font-semibold">{state.temperature.toFixed(0)} K</dd>
          </div>
          <div className="rounded-xl bg-slate-950 px-3 py-2">
            <dt className="text-slate-400">Particles</dt>
            <dd className="font-semibold">{state.particleCount}</dd>
          </div>
          <div className="rounded-xl bg-slate-950 px-3 py-2">
            <dt className="text-slate-400">Pressure</dt>
            <dd className="font-semibold">{state.pressure.toFixed(2)}</dd>
          </div>
        </dl>
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
          onClick={() => onAction({ type: "STEP", dt: 0.1 })}
          className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"
        >
          Step
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
