"use client";
// RX-005e / A17: an always-visible readout strip under the scene, identical on every profile. It shows the model
// quantities the lab declares (spec.hud), a state banner (spec.hudAlert) and the challenge status, so the
// cause-and-effect numbers are readable without scrolling the side panel. Values come only from the model.
import type { InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";
import { deriveSimulation } from "@/lib/interactive-labs/v2/fidelity/engine";

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState };

const TONE = { danger: "border-red-300 bg-red-700 text-white", info: "border-sky-300 bg-sky-900 text-sky-50", ok: "border-emerald-300 bg-emerald-800 text-white" } as const;

export function SceneHud({ definition, state }: Props) {
  const spec = definition.fidelity, fidelity = state.fidelity;
  if (!spec || !fidelity || !spec.hud?.length) return null;
  const quantities = deriveSimulation(spec, fidelity).quantities;
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
      {alert && <p data-lab-hud-alert={alert.tone} className={`mt-1.5 rounded-xl border px-2.5 py-1 text-sm font-bold ${TONE[alert.tone]}`}>{alert.text}</p>}
      {challenge && <p data-lab-hud-challenge className="mt-1.5 rounded-xl border border-amber-300 bg-amber-300/15 px-2.5 py-1 text-sm font-semibold text-amber-100">{challenge}</p>}
    </div>
  );
}
