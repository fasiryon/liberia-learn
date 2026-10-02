"use client";
// RX-005c / A14 / A17: the lab's in-scene controls as one docked bar, identical on every profile (HIGH, STANDARD,
// LOW and FALLBACK_2D). It sits directly under the scene on every screen size, so controls never cover the parts
// they act on. Each chip dispatches the same validated set-variable as its panel twin;
// tapping the control part in the scene still operates it too.
import type { InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { controlAction, controlSelected, type SceneControl } from "@/lib/interactive-labs/v2/fidelity/controls";

/**
 * The group's current values: " 2/4" for a count, " 49 m³/s" for a quantity; a group over several variables names each
 * (" · Homes blocks on 0/4 · Shops blocks on 1/4"). Toggles show nothing (the pressed chip says it).
 */
function groupValue(variables: { id: string; label: string; kind: string; max: number; unit?: string }[], values: Record<string, number>, variableIds: string[]): string {
  const shown = [...new Set(variableIds)].map((id) => variables.find((candidate) => candidate.id === id)).filter((variable) => variable && variable.kind !== "toggle" && values[variable.id] !== undefined) as { id: string; label: string; max: number; unit?: string }[];
  const format = (variable: (typeof shown)[number]) => variable.unit ? `${values[variable.id]} ${variable.unit}` : `${values[variable.id]}/${variable.max}`;
  if (shown.length === 1 && new Set(variableIds).size === 1) return ` ${format(shown[0])}`;
  return shown.map((variable) => ` · ${variable.label} ${format(variable)}`).join("");
}

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; dispatch: (action: LabAction) => void };

export function SceneControlBar({ definition, state, dispatch }: Props) {
  const spec = definition.fidelity, fidelity = state.fidelity;
  if (!spec || !fidelity) return null;
  const groups = new Map<string, { label: string; controls: { id: string; name: string; control: SceneControl }[] }>();
  for (const component of spec.components) {
    if (!component.control) continue;
    const key = component.control.group ?? component.control.variableId;
    const group = groups.get(key) ?? { label: component.control.groupLabel ?? spec.variables.find((variable) => variable.id === component.control!.variableId)?.label ?? key, controls: [] };
    group.controls.push({ id: component.id, name: component.label, control: component.control });
    groups.set(key, group);
  }
  if (!groups.size) return null;
  return (
    <div data-lab-scene-controls className="flex flex-wrap gap-2 border-t border-white/10 bg-slate-950 p-2">
      {[...groups.entries()].map(([key, group]) => (
        <div key={key} role="group" aria-label={group.label} className="flex flex-wrap items-center gap-1 rounded-2xl bg-white/5 p-1 pl-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">{group.label}{groupValue(spec.variables, fidelity.variables, group.controls.map(({ control }) => control.variableId))}</span>
          {group.controls.map(({ id, name, control }) => {
            const action = controlAction(spec, fidelity, control);
            const selected = controlSelected(fidelity, control);
            return (
              <button key={id} type="button" data-lab-control={id} aria-label={name} aria-pressed={selected} disabled={!action} title={name}
                onClick={() => { if (action) dispatch(action); }}
                className={`min-h-11 min-w-11 whitespace-nowrap rounded-full border-2 px-3 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-white bg-amber-300 text-slate-950" : "border-slate-600 bg-white text-slate-900 hover:bg-amber-100"}`}>
                {control.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
