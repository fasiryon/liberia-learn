"use client";
// RX-005e / A17: an always-visible readout strip under the scene, identical on every profile. It shows the model
// quantities the lab declares (spec.hud), a state banner (spec.hudAlert) and the challenge status, so the
// cause-and-effect numbers are readable without scrolling the side panel. Values come only from the model.
import type { InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { deriveSimulation } from "@/lib/interactive-labs/v2/fidelity/engine";
import { statusVisual } from "@/lib/interactive-labs/v2/fidelity/palette";
import { ProtectionReset } from "./ProtectionReset";

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; dispatch: (action: LabAction) => void };

const TONE = { danger: "border-red-300 bg-red-700 text-white", info: "border-sky-300 bg-sky-900 text-sky-50", ok: "border-emerald-300 bg-emerald-800 text-white" } as const;

export function SceneHud({ definition, state, dispatch }: Props) {
  const spec = definition.fidelity, fidelity = state.fidelity;
  if (!spec || !fidelity || !spec.hud?.length) return null;
  const simulation = deriveSimulation(spec, fidelity), quantities = simulation.quantities;
  // A19 / G3: every visible status lamp stated in text, with its glyph (the scene glyph and colour say the same).
  const lamps = spec.components.flatMap((component) => {
    const cue = statusVisual(simulation.componentStates[component.id]?.status).cue;
    return cue && !component.internal && component.selectable !== false && component.detail !== "decor" ? [{ id: component.id, label: component.label, ...cue }] : [];
  });
  const alert = spec.hudAlert?.(quantities) ?? null;
  const challenge = state.mode === "CHALLENGE" && spec.challengeStatus ? spec.challengeStatus(quantities) : null;
  return (
    <div data-lab-hud className="border-t border-white/10 bg-slate-900 px-2 py-2 text-white">
      <dl className="flex flex-wrap gap-1.5">
        {spec.hud.map((chip) => {
          const value = quantities[chip.quantityId];
          if (value === undefined) return null;
          return (
            <div key={chip.quantityId} data-lab-hud-quantity={chip.quantityId} className="flex items-baseline gap-1.5 rounded-xl bg-white/10 px-2.5 py-1">
              <dt className="text-[11px] font-semibold text-slate-300">{chip.label}</dt>
              <dd className="text-sm font-bold tabular-nums">{value.toFixed(chip.digits ?? 0)}{chip.unit ? ` ${chip.unit}` : ""}</dd>
            </div>
          );
        })}
      </dl>
      {definition.id === "mount-coffee-hydropower" && <p className="mt-1 text-xs text-slate-300">Scene gauge: upper row = available capacity (22 MW per segment); lower row = demand. Delivery is zero while tripped.</p>}
      {lamps.length > 0 && <ul aria-label="Status lamps" className="mt-1.5 flex flex-wrap gap-1.5">
        {lamps.map((lamp) => <li key={lamp.id} data-lab-hud-status={lamp.id} className="rounded-xl bg-white/10 px-2.5 py-1 text-xs font-semibold"><span aria-hidden="true" className="mr-1">{lamp.glyph}</span>{lamp.label}: {lamp.text}</li>)}
      </ul>}
      {alert && <p role="status" data-lab-hud-alert={alert.tone} className={`mt-1.5 rounded-xl border px-2.5 py-1 text-sm font-bold ${TONE[alert.tone]}`}>{alert.text}</p>}
      <ProtectionReset definition={definition} state={state} dispatch={dispatch} surface="hud" />
      {challenge && <p data-lab-hud-challenge className="mt-1.5 rounded-xl border border-amber-300 bg-amber-300/15 px-2.5 py-1 text-sm font-semibold text-amber-100">{challenge}</p>}
      {state.mode === "CHALLENGE" && <p data-lab-challenge-peek title={spec.authoring.challenge} className="mt-1.5 truncate rounded-lg border border-amber-200/50 bg-amber-200/10 px-2.5 py-1 text-xs font-bold text-amber-50 lg:hidden">Goal: {spec.authoring.challenge}</p>}
    </div>
  );
}
