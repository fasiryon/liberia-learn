"use client";

import type { ChemicalReactionAction } from "@/lib/labs/chemical-reaction/actions";
import type { ChemicalReactionState } from "@/lib/labs/chemical-reaction/state";

export default function ChemicalReactionFallback({
  state,
  onAction,
}: {
  state: ChemicalReactionState;
  onAction: (action: ChemicalReactionAction) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <h3 className="text-lg font-semibold">Chemical Reaction Lab</h3>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>Reactant A: {state.reactantA.toFixed(1)} mol</p>
        <p>Reactant B: {state.reactantB.toFixed(1)} mol</p>
        <p>Product C: {state.productC.toFixed(1)} mol</p>
        <p>Temperature: {state.temperature.toFixed(0)} C</p>
        <p>Reaction rate: {state.reactionRate.toFixed(3)}</p>
        <p>Reaction status: {state.reactionStarted ? "Started" : "Not started"}</p>
        <p>Catalyst: {state.catalyst ? "Active" : "None"}</p>
        <p>Energy: {state.energyType}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction({ type: "START_REACTION" })} className="min-h-11 rounded-full bg-[var(--ll-silver-soft)] px-4 text-sm font-semibold text-[var(--ll-text-faint)]">
          Start Reaction
        </button>
        <button type="button" onClick={() => onAction({ type: state.catalyst ? "REMOVE_CATALYST" : "ADD_CATALYST" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm">
          {state.catalyst ? "Remove Catalyst" : "Add Catalyst"}
        </button>
        <button type="button" onClick={() => onAction({ type: "RESET" })} className="min-h-11 rounded-full border border-[var(--ll-border)] px-4 text-sm">
          Reset
        </button>
      </div>
    </div>
  );
}
