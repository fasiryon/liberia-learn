"use client";
// RX-005d / A14: a learner-advanced camera tour. Only the focused Next button (or → while the scene itself has focus)
// advances it; Space is not a rail key. Rails are presentation only: each stop is an ordinary camera preset.
import type { HighFidelitySpec } from "@/lib/interactive-labs/v2/fidelity/types";
import { findPreset, findRail, type RailPosition } from "@/lib/interactive-labs/v2/fidelity/camera";

type Props = { spec: HighFidelitySpec; position: RailPosition; onNext: () => void; onSkip: () => void };

export function CameraRailBar({ spec, position, onNext, onSkip }: Props) {
  const rail = findRail(spec, position.railId);
  const stop = rail?.stops[position.index];
  if (!rail || !stop) return null;
  const last = position.index >= rail.stops.length - 1;
  return (
    <div role="group" aria-label={`Camera tour: ${rail.label}`} data-lab-camera-rail={rail.id} data-lab-rail-stop={position.index} className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
      <p aria-live="polite" className="mr-auto">Tour: {rail.label} · stop {position.index + 1} of {rail.stops.length}: <strong>{findPreset(spec, stop.presetId).label}</strong></p>
      <button type="button" onClick={onNext} className="min-h-11 rounded-full bg-cyan-300 px-4 font-bold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{last ? "Finish tour" : "Next"}</button>
      {!last && <button type="button" onClick={onSkip} className="min-h-11 rounded-full border border-white/20 px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Skip tour</button>}
    </div>
  );
}
