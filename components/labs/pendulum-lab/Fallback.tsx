"use client";

import type { PendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import type { PendulumLabState } from "@/lib/labs/pendulum-lab/state";

export default function PendulumFallback({
  state,
  onAction,
}: {
  state: PendulumLabState;
  onAction: (action: PendulumLabAction) => void;
}) {
  const left = 50 + Math.sin(state.angle * (Math.PI / 180)) * 38;

  return (
    <section className="bg-slate-950 p-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="relative h-48 rounded-xl bg-slate-950">
          <div className="absolute left-1/2 top-6 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-200" />
          <div className="absolute left-[12%] right-[12%] top-28 h-px bg-slate-700" />
          <div
            className="absolute top-28 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400"
            style={{ left: `${left}%` }}
          />
        </div>
        <dl className="mt-4 grid gap-2 text-sm text-slate-100 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-950 px-3 py-2">
            <dt className="text-slate-400">Angle</dt>
            <dd className="font-semibold">{state.angle.toFixed(1)} deg</dd>
          </div>
          <div className="rounded-xl bg-slate-950 px-3 py-2">
            <dt className="text-slate-400">Angular velocity</dt>
            <dd className="font-semibold">{state.angularVelocity.toFixed(2)} rad/s</dd>
          </div>
          <div className="rounded-xl bg-slate-950 px-3 py-2">
            <dt className="text-slate-400">Time</dt>
            <dd className="font-semibold">{state.time.toFixed(2)} s</dd>
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
          onClick={() => onAction({ type: "STEP", dt: 0.05 })}
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
