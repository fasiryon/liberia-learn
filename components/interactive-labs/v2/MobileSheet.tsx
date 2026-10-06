"use client";
// RX-005e / A17 mobile portrait shell: the lab controls live in a bottom sheet with peek, half and full snap points.
// The peek always shows the task, the status chips and the latest causal explanation line, so the learner can watch
// the scene and still know what to do and why. The handle cycles the snap points on Enter/Space or a tap and snaps
// up or down on a drag; while peeking, the panel body is hidden so keyboard focus skips it.
import { useRef, type ReactNode } from "react";
import type { InteractiveLabDefinition, LabState, LearningCheck } from "@/lib/interactive-labs/v2/types";
import { deriveSimulation, explainState } from "@/lib/interactive-labs/v2/fidelity/engine";
import { labTaskPrompt } from "./LabControlPanel";

export type SheetSnap = "peek" | "half" | "full";
const ORDER: SheetSnap[] = ["peek", "half", "full"];
const HEIGHT: Record<SheetSnap, string | undefined> = { peek: undefined, half: "50dvh", full: "88dvh" };
/** A drag of at least this many pixels on the handle moves one snap point. */
const DRAG_PX = 30;

export function nextSnap(snap: SheetSnap): SheetSnap { return snap === "full" ? "peek" : ORDER[ORDER.indexOf(snap) + 1]; }
export function dragSnap(snap: SheetSnap, dy: number): SheetSnap {
  const index = ORDER.indexOf(snap);
  return dy <= -DRAG_PX ? ORDER[Math.min(ORDER.length - 1, index + 1)] : dy >= DRAG_PX ? ORDER[Math.max(0, index - 1)] : snap;
}

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; activeCheck: LearningCheck | undefined; snap: SheetSnap; onSnap: (snap: SheetSnap) => void; children: ReactNode };

export function MobileSheet({ definition, state, activeCheck, snap, onSnap, children }: Props) {
  const spec = definition.fidelity, fidelity = state.fidelity;
  const quantities = spec && fidelity ? deriveSimulation(spec, fidelity).quantities : {};
  const latest = spec && fidelity ? explainState(spec, fidelity, definition.grade).at(-1) : undefined;
  const drag = useRef<{ y: number; dragged: boolean } | null>(null);
  const action = snap === "peek" ? "show more" : snap === "half" ? "expand" : "collapse";
  return (
    <aside id="lab-controls" aria-label="Lab controls" data-lab-sheet={snap} style={{ height: HEIGHT[snap] }}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-white/15 bg-slate-950 text-white shadow-[0_-12px_32px_rgba(0,0,0,.45)]">
      <button type="button" aria-expanded={snap !== "peek"} aria-controls="lab-sheet-body" aria-label={`Lab controls and next step: ${action}`}
        onClick={() => { if (drag.current?.dragged) { drag.current = null; return; } onSnap(nextSnap(snap)); }}
        onPointerDown={(event) => { drag.current = { y: event.clientY, dragged: false }; }}
        onPointerUp={(event) => { const start = drag.current; if (!start) return; const next = dragSnap(snap, event.clientY - start.y); if (next !== snap) { start.dragged = true; onSnap(next); } }}
        className="flex min-h-11 w-full touch-none flex-col items-center gap-1 px-4 pb-1 pt-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white">
        <span aria-hidden="true" className="block h-1.5 w-10 rounded-full bg-white/40" />
        <span className="flex w-full items-center justify-between"><span>Lab controls and next step</span><span aria-hidden="true" className="text-cyan-200">{snap === "full" ? "⌄" : "⌃"}</span></span>
      </button>
      <div data-lab-sheet-peek className="space-y-1 px-4 pb-2 text-xs">
        <p className="line-clamp-2 font-semibold text-slate-100">{labTaskPrompt(definition, state, activeCheck)}</p>
        {spec?.hud?.length ? <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-300">{spec.hud.map((chip) => quantities[chip.quantityId] === undefined ? null : <span key={chip.quantityId}>{chip.label} <b className="tabular-nums text-white">{quantities[chip.quantityId].toFixed(chip.digits ?? 0)}{chip.unit ? ` ${chip.unit}` : ""}</b></span>)}</p> : null}
        {latest && <p className="line-clamp-2 text-slate-300">{latest.text}</p>}
      </div>
      <div id="lab-sheet-body" hidden={snap === "peek"} className="min-h-0 flex-1 overflow-y-auto border-t border-white/10">{children}</div>
    </aside>
  );
}
