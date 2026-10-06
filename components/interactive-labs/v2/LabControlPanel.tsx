"use client";
import { useState } from "react";
import type { InteractiveLabDefinition, LabAction, LabMode, LabState, LearningCheck } from "@/lib/interactive-labs/v2/types";
import { deriveSimulation, explainState, isComponentRevealed, protectionStatus } from "@/lib/interactive-labs/v2/fidelity/engine";
import { formatVariable, stepVariable } from "@/lib/interactive-labs/v2/fidelity/variables";
import { ProtectionReset } from "./ProtectionReset";

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; activeCheck: LearningCheck | undefined; dispatch: (action: LabAction) => void; onStartRail?: (railId: string) => void };

const chip = (active: boolean) => `min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-200 hover:bg-white/15"}`;
const MODES: Exclude<LabMode, "COMPLETE">[] = ["GUIDED", "EXPLORE", "CHALLENGE", "ASSESSMENT"];

/**
 * One control surface for every capability profile. Anything the scene can do by pointer is also here,
 * so keyboard users and FALLBACK_2D learners reach every check.
 */
/** The learner's current task, as the panel states it: the guided step, the challenge, or the next check (A17 peek). */
export function labTaskPrompt(definition: InteractiveLabDefinition<LabState>, state: LabState, activeCheck: LearningCheck | undefined): string {
  const spec = definition.fidelity, fidelity = state.fidelity;
  const guidedIndex = spec && fidelity ? Math.max(fidelity.guidedStepIndex, Math.min(state.completedChecks.length, spec.guidedPath.length - 1)) : 0;
  const guided = spec && fidelity && state.mode === "GUIDED" ? spec.guidedPath[guidedIndex] : undefined;
  return guided?.prompt ?? (state.mode === "CHALLENGE" && spec ? spec.authoring.challenge : activeCheck?.prompt ?? "You completed every check!");
}

export function LabControlPanel({ definition, state, activeCheck, dispatch, onStartRail }: Props) {
  const spec = definition.fidelity, fidelity = state.fidelity;
  const [heldFace, setHeldFace] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const modes = spec?.modes ?? MODES;
  const guidedIndex = spec && fidelity ? Math.max(fidelity.guidedStepIndex, Math.min(state.completedChecks.length, spec.guidedPath.length - 1)) : 0;
  const guided = spec && fidelity && state.mode === "GUIDED" ? spec.guidedPath[guidedIndex] : undefined;
  const simulation = spec && fidelity ? deriveSimulation(spec, fidelity) : null;
  const modeOwnsTask = state.mode === "GUIDED" || state.mode === "CHALLENGE";
  const target = modeOwnsTask ? undefined : activeCheck?.fidelity;
  const taskPrompt = labTaskPrompt(definition, state, activeCheck);
  const explanation = spec && fidelity ? explainState(spec, fidelity, definition.grade) : [];
  // R3 interaction P1: a check made while the plant is still tripped fails for that reason, not the learner's arithmetic.
  const protection = spec && state.fidelity ? protectionStatus(spec, state.fidelity) : null;
  const trippedHint = protection?.latched ? (protection.blocker ?? `Your setting may be right, but the plant is still tripped. Press ${protection.resetLabel}, then check again.`) : null;
  const hint = state.lastFeedback === "incorrect" ? trippedHint ?? (activeCheck?.hints.length ? activeCheck.hints[Math.min(activeCheck.hints.length - 1, Math.max(0, state.retries - 1))] : null) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lab mode">
        {modes.map((mode) => <button key={mode} type="button" aria-pressed={state.mode === mode} onClick={() => dispatch({ type: "mode", mode })} className={chip(state.mode === mode)}>{mode[0] + mode.slice(1).toLowerCase()}</button>)}
      </div>

      {(explanation.length > 0 || Object.keys(simulation?.quantities ?? {}).length > 0) && (
        <section aria-label="What is happening" aria-live="polite" className="sticky top-1 z-20 max-h-[20vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">What is happening</h3>
          {/* R3 visual P1: the cue shows on every screen size; a fade marks the cut-off line. */}
          <p className="mt-1 text-[10px] text-slate-400">Scroll this panel for more details</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">{explanation.map((line) => <li key={line.id}>{line.text}</li>)}</ul>
          <div aria-hidden="true" className="pointer-events-none sticky -bottom-3 -mx-3 -mb-3 h-6 bg-gradient-to-t from-slate-950 to-transparent" />
        </section>
      )}

      {guided && spec && fidelity && (
        <section aria-label="Guided path" className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Step {guidedIndex + 1} of {spec.guidedPath.length}</p>
          <p className="mt-1 text-sm text-slate-100">{guided.prompt}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={guidedIndex === 0} onClick={() => dispatch({ type: "guided-step", index: guidedIndex - 1 })} className={`${chip(false)} disabled:opacity-40`}>Back</button>
            <button type="button" disabled={guidedIndex >= spec.guidedPath.length - 1} onClick={() => dispatch({ type: "guided-step", index: guidedIndex + 1 })} className={`${chip(true)} disabled:opacity-40`}>Next step</button>
          </div>
        </section>
      )}

      <section aria-label="Your task">
        <p className="text-sm text-slate-400">{state.mode === "GUIDED" ? `Guided step ${guidedIndex + 1}` : state.mode === "CHALLENGE" ? "Challenge objective" : "Your next task"}</p>
        <h2 className="mt-1 text-lg font-bold text-white">{taskPrompt}</h2>
        {state.mode === "CHALLENGE" && spec?.challengeStatus && simulation && <p role="status" className="mt-2 text-sm text-amber-100">{spec.challengeStatus(simulation.quantities)}</p>}
        {modeOwnsTask && activeCheck && <p className="mt-3 text-xs text-slate-400">Knowledge checks are available in Assessment mode.</p>}

        {activeCheck?.id === "cube-vertices" && (
          <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Cube vertices">
            <span className="col-span-4 text-xs text-slate-400">Tap each corner:</span>
            {Array.from({ length: 8 }, (_, index) => <button key={index} type="button" onClick={() => dispatch({ type: "highlight-feature", objectId: "cube", feature: "vertex", index })} className={`min-h-11 min-w-11 rounded-lg px-2 py-2 text-sm ${state.highlightedFeatures.cube?.indices.includes(index) ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white"}`}>{index + 1}</button>)}
          </div>
        )}

        {target?.kind === "trace-path" && spec && fidelity && (() => {
          const flow = spec.flows.find((candidate) => candidate.id === target.flowId)!;
          const traced = fidelity.tracedPaths[flow.id] ?? [];
          // Buttons are alphabetical so the list never gives away the order.
          const nodes = flow.nodes.filter((node) => node.traceable).sort((a, b) => a.label.localeCompare(b.label));
          return (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-400">Tap parts in the scene, or here:</p>
              <div className="flex flex-wrap gap-2">{nodes.map((node) => <button key={node.id} type="button" onClick={() => dispatch({ type: "trace-node", flowId: flow.id, nodeId: node.id })} className={chip(traced.includes(node.id))}>{node.label}</button>)}</div>
              <ol className="flex flex-wrap gap-1 text-xs text-amber-200" aria-label="Your path">{traced.map((nodeId, index) => <li key={`${nodeId}-${index}`}>{index + 1}. {flow.nodes.find((node) => node.id === nodeId)?.label}{index < traced.length - 1 ? " →" : ""}</li>)}</ol>
              {traced.length > 0 && <button type="button" onClick={() => dispatch({ type: "clear-trace", flowId: flow.id })} className={chip(false)}>Clear path</button>}
            </div>
          );
        })()}

        {target?.kind === "assemble" && spec && fidelity && (() => {
          const assembly = spec.assemblies.find((candidate) => candidate.id === target.assemblyId)!;
          const placements = fidelity.placements[assembly.id] ?? {};
          if (!fidelity.disassembled.includes(assembly.id)) return <button type="button" onClick={() => dispatch({ type: "clear-assembly", assemblyId: assembly.id })} className="mt-4 min-h-11 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950">Take the {assembly.label.toLowerCase().replace(/ faces$/, "")} apart</button>;
          const placed = new Set(Object.values(placements));
          const loose = assembly.componentIds.filter((id) => !placed.has(id));
          const face = (id: string) => spec.components.find((component) => component.id === id)!;
          return (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400">1. Pick up a part</p>
                <div className="mt-2 flex flex-wrap gap-2">{loose.map((id) => { const c = face(id), [w, h] = [c.transform.scale[0], c.transform.scale[1]]; return (
                  <button key={id} type="button" draggable aria-grabbed={heldFace === id} onDragStart={() => setHeldFace(id)} onClick={() => setHeldFace(heldFace === id ? null : id)} className={`flex min-h-11 flex-col items-center gap-1 rounded-xl p-2 text-[11px] ${heldFace === id ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white"}`}>
                    <svg width={w * 16} height={h * 16} aria-hidden="true"><rect width={w * 16} height={h * 16} rx="2" fill={c.material.color} /></svg>{c.label}
                  </button>); })}{loose.length === 0 && <span className="text-xs text-emerald-300">All parts placed.</span>}</div>
              </div>
              <div>
                <p className="text-xs text-slate-400">2. Put it in a slot</p>
                <div className="mt-2 grid grid-cols-2 gap-2">{assembly.slots!.map((slot) => { const current = placements[slot.id]; return (
                  <div key={slot.id} className="flex items-center gap-1">
                    <button type="button" disabled={!heldFace} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (heldFace) { setPendingSlot(slot.id); } }} onClick={() => { if (heldFace) setPendingSlot(slot.id); }} className="min-h-11 flex-1 rounded-lg border border-dashed border-white/20 px-2 py-1.5 text-left text-xs text-slate-200 disabled:opacity-60">{slot.label}: <b>{current ? face(current).label : "empty"}</b></button>
                    {pendingSlot === slot.id && heldFace && <button type="button" onClick={() => { dispatch({ type: "place-component", assemblyId: assembly.id, slotId: slot.id, componentId: heldFace }); setHeldFace(null); setPendingSlot(null); }} className="min-h-11 rounded-lg bg-emerald-300 px-2 text-xs font-bold text-slate-950">Confirm</button>}
                    {current && <button type="button" aria-label={`Remove ${face(current).label} from ${slot.label}`} onClick={() => dispatch({ type: "place-component", assemblyId: assembly.id, slotId: slot.id, componentId: null })} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10 text-xs">×</button>}
                  </div>); })}</div>
              </div>
            </div>
          );
        })()}

        {!modeOwnsTask && activeCheck && <button type="button" onClick={() => dispatch({ type: "check", checkId: activeCheck.id, response: { answer: state.selectedObjectId } })} className="mt-5 w-full rounded-2xl bg-emerald-300 px-4 py-3 font-bold text-slate-950">Check my work</button>}
        {state.lastFeedback && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${state.lastFeedback === "correct" ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>{state.lastFeedback === "correct" ? "Nice work. Your action showed the idea." : `Not yet. ${hint ?? "Try changing the scene again."}`}</p>}
      </section>

      {spec && fidelity && (
        <>
          {spec.variables.some((variable) => variable.learnerControlled) && (
            <section aria-label="Controls" className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Controls</h3>
              <ProtectionReset definition={definition} state={state} dispatch={dispatch} surface="panel" />
              {spec.variables.filter((variable) => variable.learnerControlled).map((variable) => {
                const value = fidelity.variables[variable.id];
                if (variable.kind === "toggle") return <button key={variable.id} type="button" role="switch" aria-checked={value === variable.max} onClick={() => dispatch({ type: "set-variable", variableId: variable.id, value: stepVariable(variable, value, 1) })} className={chip(value === variable.max)}>{variable.label}: {variable.id === "switch" ? (value === variable.max ? "Closed" : "Open") : formatVariable(variable, value)}</button>;
                return (
                  <div key={variable.id}>
                    <label htmlFor={`var-${variable.id}`} className="flex justify-between text-xs text-slate-300"><span>{variable.label}</span><span className="font-mono text-cyan-200">{formatVariable(variable, value)}</span></label>
                    <div className="mt-1 flex items-center gap-2">
                      <button type="button" aria-label={`Decrease ${variable.label}`} onClick={() => dispatch({ type: "set-variable", variableId: variable.id, value: stepVariable(variable, value, -1) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10 text-white">−</button>
                      <input id={`var-${variable.id}`} type="range" min={variable.min} max={variable.max} step={variable.step} value={value} onChange={(event) => dispatch({ type: "set-variable", variableId: variable.id, value: Number(event.target.value) })} className="h-11 w-full accent-cyan-300" />
                      <button type="button" aria-label={`Increase ${variable.label}`} onClick={() => dispatch({ type: "set-variable", variableId: variable.id, value: stepVariable(variable, value, 1) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10 text-white">+</button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <section aria-label="Look inside" className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Look inside</h3>
            {spec.exploded.map((view) => {
              const label = spec.assemblies.find((assembly) => assembly.id === view.assemblyId)?.label ?? view.assemblyId;
              const factor = fidelity.explode[view.assemblyId] ?? 0;
              return (
                <div key={view.assemblyId}>
                  <label htmlFor={`explode-${view.assemblyId}`} className="flex justify-between text-xs text-slate-300"><span>Explode: {label}</span><span className="font-mono">{Math.round(factor * 100)}%</span></label>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => dispatch({ type: "set-explode", assemblyId: view.assemblyId, factor: factor > 0 ? 0 : 1 })} className={chip(factor > 0)}>{factor > 0 ? "Close" : "Explode"}</button>
                  <input id={`explode-${view.assemblyId}`} type="range" min={0} max={1} step={0.05} value={factor} onChange={(event) => dispatch({ type: "set-explode", assemblyId: view.assemblyId, factor: Number(event.target.value) })} className="h-11 w-full accent-cyan-300" />
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              {spec.cutaways.map((cutaway) => <button key={cutaway.id} type="button" aria-pressed={fidelity.activeCutawayId === cutaway.id} onClick={() => dispatch({ type: "set-cutaway", cutawayId: fidelity.activeCutawayId === cutaway.id ? null : cutaway.id })} className={chip(fidelity.activeCutawayId === cutaway.id)}>{cutaway.label}</button>)}
              {spec.layers.map((layer) => <button key={layer.id} type="button" aria-pressed={!fidelity.hiddenLayerIds.includes(layer.id)} onClick={() => dispatch({ type: "toggle-layer", layerId: layer.id })} className={chip(!fidelity.hiddenLayerIds.includes(layer.id))}>{layer.label}</button>)}
              <button type="button" aria-pressed={fidelity.labelsVisible} onClick={() => dispatch({ type: "toggle-labels" })} className={chip(fidelity.labelsVisible)}>Labels</button>
              {fidelity.isolatedId
                ? <button type="button" onClick={() => dispatch({ type: "isolate", targetId: null })} className={chip(true)}>Show everything</button>
                : (fidelity.inspectedComponentId ?? state.selectedObjectId) && <button type="button" onClick={() => dispatch({ type: "isolate", targetId: fidelity.inspectedComponentId ?? state.selectedObjectId })} className={chip(false)}>Isolate selected</button>}
            </div>
            <details className="rounded-xl border border-white/10 p-2">
              <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Parts and traces</summary>
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Process paths">
                {spec.flows.map((flow) => <button key={flow.id} type="button" aria-pressed={!fidelity.hiddenFlowIds.includes(flow.id)} onClick={() => dispatch({ type: "toggle-flow", flowId: flow.id })} className={chip(!fidelity.hiddenFlowIds.includes(flow.id))}>Show {flow.label.toLowerCase()}</button>)}
              </div>
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Parts you can see">
              {spec.components.filter((component) => component.selectable !== false && !component.control && isComponentRevealed(spec, fidelity, component.id)).sort((a, b) => a.label.localeCompare(b.label)).map((component) => <button key={component.id} type="button" aria-pressed={fidelity.inspectedComponentId === component.id} onClick={() => dispatch({ type: "inspect-component", componentId: component.id })} className={chip(fidelity.inspectedComponentId === component.id)}>{component.label}</button>)}
            </div>
            {/* A14 tap rule: tapping a control part operates it, so its inspection lives here (collapsed, so the
                control parts do not lengthen the mobile page; R1 layout). */}
            {spec.components.some((component) => component.control) && <details className="mt-2">
              <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-slate-300">Learn about the controls</summary>
              <div className="flex flex-wrap gap-2" aria-label="Controls you can inspect">
                {spec.components.filter((component) => component.control && component.selectable !== false && isComponentRevealed(spec, fidelity, component.id)).map((component) => <button key={component.id} type="button" data-lab-inspect-control={component.id} aria-pressed={fidelity.inspectedComponentId === component.id} onClick={() => dispatch({ type: "inspect-component", componentId: component.id })} className={chip(fidelity.inspectedComponentId === component.id)}>{component.label}</button>)}
              </div>
            </details>}
            </details>
            {fidelity.inspectedComponentId && <p className="text-xs text-slate-300">{spec.components.find((component) => component.id === fidelity.inspectedComponentId)?.description ?? ""}</p>}
          </section>

          <section aria-label="Camera" className="flex flex-wrap gap-2">
            {spec.camera.presets.map((preset) => <button key={preset.id} type="button" aria-pressed={fidelity.cameraPresetId === preset.id} onClick={() => dispatch({ type: "camera-preset", presetId: preset.id })} className={chip(fidelity.cameraPresetId === preset.id)}>{preset.label}</button>)}
            {onStartRail && spec.camera.rails?.map((rail) => <button key={rail.id} type="button" onClick={() => onStartRail(rail.id)} className={chip(false)}>Tour: {rail.label}</button>)}
          </section>

        </>
      )}
    </div>
  );
}
