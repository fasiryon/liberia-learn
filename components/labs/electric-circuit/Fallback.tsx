"use client";

import type { ElectricCircuitAction } from "@/lib/labs/electric-circuit/actions";
import type { ElectricCircuitState } from "@/lib/labs/electric-circuit/state";

export default function ElectricCircuitFallback({
  state,
  onAction,
}: {
  state: ElectricCircuitState;
  onAction: (action: ElectricCircuitAction) => void;
}) {
  return (
    <section className="bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 font-mono text-sm leading-7">
        <p>Battery {state.voltage.toFixed(1)} V (+) ---- circuit ---- bulb ---- (-)</p>
        <p>
          {state.circuitType === "series"
            ? `Series: R1 ${state.resistance1.toFixed(0)} ohms -- R2 ${state.resistance2.toFixed(0)} ohms`
            : `Parallel: branch A R1 ${state.resistance1.toFixed(0)} ohms | branch B R2 ${state.resistance2.toFixed(0)} ohms`}
        </p>
        <p>Current: {state.current.toFixed(2)} A</p>
        <p>Power: {state.power.toFixed(2)} W</p>
        <p>Total Resistance: {state.totalResistance.toFixed(0)} ohms</p>
      </div>
      <button
        type="button"
        onClick={() => onAction({ type: "SET_CIRCUIT_TYPE", value: state.circuitType === "series" ? "parallel" : "series" })}
        className="mt-3 min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
      >
        {state.circuitType === "series" ? "Switch to Parallel" : "Switch to Series"}
      </button>
    </section>
  );
}
