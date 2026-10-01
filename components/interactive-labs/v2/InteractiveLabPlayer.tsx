"use client";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { initializeLab, acceptLabAction } from "@/lib/interactive-labs/v2/kernel";
import { recallProfile, readDeviceHints, rememberProfile, resolveInitialProfile, upgradeEligibility, upgradeTarget } from "@/lib/interactive-labs/v2/capabilities";
import { downgradeProfile } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { loadChunkWithRetry } from "@/lib/interactive-labs/v2/loadChunk";
import type { CapabilityProfile, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { Fallback2D } from "./Fallback2D";
import { LabControlPanel } from "./LabControlPanel";
import type { ScenePick } from "./picking";
const loadWebGLScene = () => loadChunkWithRetry(() => import("./WebGLScene"));
const WebGLScene = dynamic(() => loadWebGLScene().then((m) => m.WebGLScene), { ssr: false, loading: () => <div className="flex h-[clamp(420px,62vh,640px)] items-center justify-center text-slate-300">Loading the 3D lab…</div> });
const loadThreeScene = () => loadChunkWithRetry(() => import("./ThreeScene"));
const ThreeScene = dynamic(() => loadThreeScene().then((m) => m.ThreeScene), { ssr: false, loading: () => <div className="flex h-[clamp(420px,62vh,640px)] items-center justify-center text-slate-300">Loading the high-quality 3D lab…</div> });

class SceneLoadBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function getProfileStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

/**
 * Review-only rendering of an unapproved lab for the Interactive Lab Production Team. Only the dev-gated
 * /lab-review harness passes this; learner routes never do. It starts from a replayed scenario state,
 * skips the intro, and exposes a dispatcher for deterministic capture. It records no evidence.
 */
export type LabReviewPreview = {
  initialState: LabState;
  onReady?: (api: { dispatch: (action: LabAction) => { ok: boolean; reason?: string } }) => void;
};

export function InteractiveLabPlayer({ labId = "g4-solid-figures", override, reviewPreview }: { labId?: string; override?: CapabilityProfile; reviewPreview?: LabReviewPreview }) {
  const definition = getInteractiveLabDefinition(labId);
  const [state, setState] = useState<LabState>(() => reviewPreview ? structuredClone(reviewPreview.initialState) : initializeLab(definition ?? getInteractiveLabDefinition("g4-solid-figures")!));
  const [profile, setProfile] = useState<CapabilityProfile>(() => override ?? "LOW");
  const manualProfileChoice = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const deviceHints = typeof navigator === "undefined" ? {} : readDeviceHints(navigator);
  const canUpgrade = !reviewPreview && override === undefined && !manualProfileChoice.current && profile === "LOW" && upgradeEligibility(deviceHints);
  const [intro, setIntro] = useState(!reviewPreview);
  const checks = useMemo(() => definition?.checks ?? [], [definition]);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    if (reviewPreview && typeof window !== "undefined") {
      const reviewWindow = window as Window & { __labReviewStateRevision?: number };
      reviewWindow.__labReviewStateRevision = (reviewWindow.__labReviewStateRevision ?? 0) + 1;
    }
  }, [state, reviewPreview]);
  const reviewDispatch = useCallback((action: LabAction) => {
    if (!definition) return { ok: false, reason: "Unknown lab." };
    const result = acceptLabAction(definition, latest.current, action);
    if ("reason" in result) return { ok: false, reason: result.reason };
    latest.current = result.state;
    setState(result.state);
    return { ok: true };
  }, [definition]);
  const onReviewReady = reviewPreview?.onReady;
  useLayoutEffect(() => { onReviewReady?.({ dispatch: reviewDispatch }); }, [onReviewReady, reviewDispatch]);
  useEffect(() => {
    const next = resolveInitialProfile({ supportsWebGL: !!window.WebGLRenderingContext, requested: override, remembered: override ? null : recallProfile(getProfileStorage()) });
    setProfile(next);
  }, [override]);
  const dispatch = (action: LabAction) => setState((current) => { const result = acceptLabAction(definition, current, action); return result.ok ? result.state : current; });
  const activeCheck = checks.find((check) => !state.completedChecks.includes(check.id));
  const progress = Math.round(state.completedChecks.length / Math.max(checks.length, 1) * 100);
  const traceFlowId = activeCheck?.fidelity?.kind === "trace-path" ? activeCheck.fidelity.flowId : null;
  const onPick = (pick: ScenePick) => {
    if (pick.kind === "node") dispatch({ type: "trace-node", flowId: pick.flowId, nodeId: pick.nodeId });
    // RX-005c tap rule: tapping a control part operates it (same set-variable as the panel twin); a disabled
    // control does nothing. Inspecting a control part goes through the parts list.
    else if (pick.item.control) { if (pick.item.control.action) dispatch(pick.item.control.action); }
    else if (pick.item.kind === "object") dispatch({ type: "select", objectId: pick.item.id });
    else dispatch({ type: "inspect-component", componentId: pick.item.id });
  };
  const onDowngrade = (reason: "context" | "performance") => {
    setProfile((current) => {
      const next = reason === "context" ? "FALLBACK_2D" : downgradeProfile(current);
      rememberProfile(getProfileStorage(), next);
      return next;
    });
    setNotice(reason === "context" ? "3D is not available on this device, so the lab switched to the 2D view." : "The lab lowered its visual quality to keep things smooth.");
  };
  const onUpgradeReady = useCallback(() => {
    setProfile((current) => {
      if (current !== "LOW" || !canUpgrade) return current;
      const next = upgradeTarget({ reducedMotion });
      rememberProfile(getProfileStorage(), next);
      return next;
    });
  }, [canUpgrade, reducedMotion]);
  const onRendererLoadError = useCallback(() => {
    const next: CapabilityProfile = profile === "HIGH" || profile === "STANDARD" ? "LOW" : "FALLBACK_2D";
    setProfile(next);
    rememberProfile(getProfileStorage(), next);
    setNotice(next === "LOW" ? "The detailed graphics could not load, so the lab switched to LOW graphics." : "3D graphics could not load, so the lab switched to the 2D view.");
  }, [profile]);

  if (!definition || (!reviewPreview && (definition.reviewState !== "APPROVED" || definition.approvalState !== "APPROVED"))) return <p className="p-6">This lab is not available.</p>;

  if (intro) return <section className="mx-auto max-w-5xl rounded-3xl bg-slate-950 p-8 text-white shadow-2xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-cyan-300">Interactive lab</p><h1 className="mt-3 text-3xl font-bold">{definition.title ?? "Interactive lab"}</h1><p className="mt-4 max-w-2xl text-slate-300">{definition.summary ?? "Use the scene to complete the checks."}</p><button type="button" onClick={() => setIntro(false)} className="mt-7 rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950">Start exploring</button></section>;

  return (
    <section className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Grade {definition.grade} · {definition.subject[0] + definition.subject.slice(1).toLowerCase()}</p><h1 className="text-xl font-bold">{definition.title ?? definition.id}</h1></div>
        <div className="flex items-center gap-2 text-sm">
          <span>{progress}% complete</span>
          <label className="sr-only" htmlFor="profile">Visual quality</label>
          <select id="profile" value={profile} onChange={(event) => { const next = event.target.value as CapabilityProfile; manualProfileChoice.current = true; setNotice(null); rememberProfile(getProfileStorage(), next); setProfile(next); }} className="min-h-11 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white"><option>HIGH</option><option>STANDARD</option><option>LOW</option><option>FALLBACK_2D</option></select>
        </div>
      </div>
      {notice && <p role="status" className="border-b border-white/10 bg-amber-300/10 px-5 py-2 text-xs text-amber-100">{notice}</p>}
      <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
        <div className={definition.fidelity?.environment === "DAYLIGHT" ? "bg-[linear-gradient(#dbeafe,#f1f5f9_58%,#dce7d4)] text-slate-900" : "bg-[radial-gradient(circle_at_50%_38%,#263d72,#080d20_68%)]"}>
          {profile === "FALLBACK_2D"
            ? <Fallback2D definition={definition} state={state} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} />
            : <SceneLoadBoundary key={profile} onError={onRendererLoadError} fallback={<Fallback2D definition={definition} state={state} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} />}>
                {profile === "HIGH" || profile === "STANDARD"
                  ? <ThreeScene definition={definition} state={state} profile={profile} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} onDowngrade={onDowngrade} onUpgradeReady={onUpgradeReady} allowProfileUpgrade={canUpgrade} allowPerformanceDowngrade={!reviewPreview} />
                  : <WebGLScene definition={definition} state={state} profile={profile} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} onDowngrade={onDowngrade} onUpgradeReady={onUpgradeReady} allowProfileUpgrade={canUpgrade} allowPerformanceDowngrade={!reviewPreview} />}
              </SceneLoadBoundary>}
        </div>
        <aside className="lg:max-h-[clamp(420px,62vh,640px)] lg:overflow-y-auto border-l border-white/10 bg-white/[.03] p-5">
          <LabControlPanel definition={definition} state={state} activeCheck={activeCheck} dispatch={dispatch} />
          <div className="mt-8 flex gap-2">
            <button type="button" onClick={() => dispatch({ type: "reset" })} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm">Reset</button>
            {definition.scene.objects.length > 0 && <button type="button" onClick={() => dispatch({ type: "focus", objectId: state.selectedObjectId ?? definition.scene.objects[0].id })} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm">Focus</button>}
          </div>
        </aside>
      </div>
    </section>
  );
}
