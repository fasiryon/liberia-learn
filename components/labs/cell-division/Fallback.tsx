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
    <section className="bg-slate-950 p-4 text-slate-100">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-3xl font-bold text-white">{state.stage.toUpperCase()}</p>
        <p className="mt-3 text-sm leading-6 text-slate-200">{descriptions[state.stage]}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-950 p-3">Chromosomes: {state.chromosomeCount}</div>
          <div className="rounded-xl bg-slate-950 p-3">Cells: {state.cellCount}</div>
          <div className="rounded-xl bg-slate-950 p-3">Progress: {state.progress.toFixed(0)}%</div>
        </div>
      </div>
      <button type="button" onClick={() => onAction({ type: "ADVANCE_STAGE" })} className="mt-3 min-h-11 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
        Next Stage
      </button>
    </section>
  );
}
