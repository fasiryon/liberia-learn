"use client";

import type { CellDivisionAction } from "@/lib/labs/cell-division/actions";
import type { CellDivisionState } from "@/lib/labs/cell-division/state";

const descriptions: Record<CellDivisionState["stage"], string> = {
  interphase: "The cell grows, copies DNA, and prepares for mitosis.",
  prophase: "Chromosomes condense into visible X shapes and the nucleus starts to break down.",
  metaphase: "Chromosomes line up across the middle of the cell.",
  anaphase: "Sister chromatids separate, so the visible chromosome count doubles.",
  telophase: "Two nuclei form around the separated chromosome sets.",
  cytokinesis: "The cell membrane splits, forming two daughter cells.",
};

export default function CellDivisionFallback({
  state,
  onAction,
}: {
  state: CellDivisionState;
  onAction: (action: CellDivisionAction) => void;
}) {
  return (
    <section className="bg-[var(--ll-bg)] p-4 text-[var(--ll-text)]">
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-5">
        <p className="text-3xl font-bold text-[var(--ll-text)]">{state.stage.toUpperCase()}</p>
        <p className="mt-3 text-sm leading-6 text-[var(--ll-text)]">{descriptions[state.stage]}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--ll-bg)] p-3">Chromosomes: {state.chromosomeCount}</div>
          <div className="rounded-xl bg-[var(--ll-bg)] p-3">Cells: {state.cellCount}</div>
          <div className="rounded-xl bg-[var(--ll-bg)] p-3">Progress: {state.progress.toFixed(0)}%</div>
        </div>
      </div>
      <button type="button" onClick={() => onAction({ type: "ADVANCE_STAGE" })} className="mt-3 min-h-11 rounded-xl bg-[var(--ll-silver-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
        Next Stage
      </button>
    </section>
  );
}
