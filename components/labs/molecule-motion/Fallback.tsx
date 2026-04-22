"use client";

import type { MoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import type { MoleculeMotionState } from "@/lib/labs/molecule-motion/state";

function phaseColor(phase: MoleculeMotionState["phase"]) {
  if (phase === "solid") return "bg-[var(--ll-silver-soft)]";
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
    <section className="bg-[var(--ll-bg)] p-4">
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4">
        <div className={`flex h-44 items-center justify-center rounded-xl ${phaseColor(state.phase)} text-3xl font-bold uppercase text-[var(--ll-text)]`}>
          {state.phase}
        </div>
        <dl className="mt-4 grid gap-2 text-sm text-[var(--ll-text)] sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--ll-bg)] px-3 py-2">
            <dt className="text-[var(--ll-text-muted)]">Temperature</dt>
            <dd className="font-semibold">{state.temperature.toFixed(0)} K</dd>
          </div>
          <div className="rounded-xl bg-[var(--ll-bg)] px-3 py-2">
            <dt className="text-[var(--ll-text-muted)]">Particles</dt>
            <dd className="font-semibold">{state.particleCount}</dd>
          </div>
          <div className="rounded-xl bg-[var(--ll-bg)] px-3 py-2">
            <dt className="text-[var(--ll-text-muted)]">Pressure</dt>
            <dd className="font-semibold">{state.pressure.toFixed(2)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onAction(state.paused ? { type: "PLAY" } : { type: "PAUSE" })}
          className="min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          {state.paused ? "Play" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "STEP", dt: 0.1 })}
          className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          Step
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "RESET" })}
          className="min-h-11 rounded-xl border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
