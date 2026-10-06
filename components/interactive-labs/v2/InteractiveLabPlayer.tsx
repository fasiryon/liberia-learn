"use client";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { initializeLab, acceptLabAction } from "@/lib/interactive-labs/v2/kernel";
import { recallPerformanceDowngrade, recallProfile, readDeviceHints, rememberPerformanceDowngrade, rememberProfile, resolveInitialProfile, upgradeEligibility, upgradeTarget } from "@/lib/interactive-labs/v2/capabilities";
import { downgradeProfile } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { loadChunkWithRetry } from "@/lib/interactive-labs/v2/loadChunk";
import type { CapabilityProfile, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { Fallback2D } from "./Fallback2D";
import { LabControlPanel } from "./LabControlPanel";
import { SceneControlBar } from "./SceneControlBar";
import { SceneHud } from "./SceneHud";
import { CameraRailBar } from "./CameraRailBar";
import { PHONE_LANDSCAPE_QUERY, SCENE_HEIGHT } from "./sceneLayout";
import { MobileSheet, type SheetSnap } from "./MobileSheet";
import { advanceRail, DEFAULT_LEG, findRail, railStop, type CameraLeg, type RailPosition } from "@/lib/interactive-labs/v2/fidelity/camera";
import type { CameraPose } from "@/lib/interactive-labs/v2/fidelity/presentation";
import type { ScenePick } from "./picking";
import { activateControl, controlAction, dragAction, type PendingControl } from "@/lib/interactive-labs/v2/fidelity/controls";
const loadWebGLScene = () => loadChunkWithRetry(() => import("./WebGLScene"));
// A17: while a renderer chunk loads, the current state's 2D render shows under a loading veil (see SceneLoadingVeil).
const WebGLScene = dynamic(() => loadWebGLScene().then((m) => m.WebGLScene), { ssr: false, loading: () => <div className={SCENE_HEIGHT} /> });
const loadThreeScene = () => loadChunkWithRetry(() => import("./ThreeScene"));
const ThreeScene = dynamic(() => loadThreeScene().then((m) => m.ThreeScene), { ssr: false, loading: () => <div className={SCENE_HEIGHT} /> });

/** The 2D view of the same state, inert under a veil, until the WebGL renderer reports its first full frame (A17). */
function SceneLoadingVeil({ label, children }: { label: string; children: ReactNode }) {
  const inertRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { inertRef.current?.setAttribute("inert", ""); }, []);
  return <div className="absolute inset-0 z-10" data-lab-loading-veil><div ref={inertRef} aria-hidden="true" className="pointer-events-none h-full opacity-60">{children}</div><p role="status" className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-slate-950/80 px-4 py-1.5 text-sm font-semibold text-white">{label}</p></div>;
}

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
  // RX-005e: phone portrait puts the controls in a bottom sheet; desktop and phone landscape keep the side column.
  const [sheetMode, setSheetMode] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  // The page reserves the peek's measured height, so the HUD and alerts are never under the collapsed sheet.
  const [peekHeight, setPeekHeight] = useState(0);
  // A9 review evidence: every profile change that was not requested (context loss, slow frames, failed chunk).
  const downgradePath = useRef<string[]>([]);
  // A17: the WebGL renderer reports its first full frame; until then the 2D render shows under a veil.
  const [sceneReadyProfile, setSceneReadyProfile] = useState<CapabilityProfile | null>(null);
  const sceneReady = sceneReadyProfile === profile;
  const onSceneReady = useCallback(() => setSceneReadyProfile(profile), [profile]);
  // A3: while the HIGH/STANDARD renderer loads, prefetch the LOW chunk so an offline downgrade still has a renderer.
  useEffect(() => { if (profile === "HIGH" || profile === "STANDARD") void loadWebGLScene().catch(() => undefined); }, [profile]);
  const reducedMotion = usePrefersReducedMotion();
  const deviceHints = typeof navigator === "undefined" ? {} : { ...readDeviceHints(navigator), webgl2: typeof window !== "undefined" && typeof window.WebGL2RenderingContext === "function" };
  // A performance downgrade in this session, or remembered from an earlier one, blocks every later auto-upgrade.
  const performanceDowngraded = useRef(false);
  const canUpgrade = !reviewPreview && override === undefined && !manualProfileChoice.current && !performanceDowngraded.current && profile === "LOW" && upgradeEligibility(deviceHints) && !recallPerformanceDowngrade(getProfileStorage());
  const [intro, setIntro] = useState(!reviewPreview);
  // R3 interaction P1: restarting wipes progress, so it asks once inline (no browser dialog) and never reads as "Reset plant".
  const [confirmRestart, setConfirmRestart] = useState(false);
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
  // A14 pending confirm: presentation only. It lives here, never in LabState, so it never reaches acceptLabAction
  // or the events route (IGNORED). Escape, blur or Cancel clears it; there is no timer.
  const [pendingControl, setPendingControl] = useState<PendingControl | null>(null);
  /** One activation of a control part, from a scene tap or its chip twin (same action either way). */
  const activateControlPart = (componentId: string) => {
    const component = definition?.fidelity?.components.find((candidate) => candidate.id === componentId);
    if (!component?.control || !definition?.fidelity || !state.fidelity) return;
    const result = activateControl(pendingControl, componentId, component.control, controlAction(definition.fidelity, state.fidelity, component.control));
    setPendingControl(result.pending);
    if (result.dispatch) dispatch(result.dispatch);
  };
  /** A14 drag control: `t` is the pointer's position along the part's drag axis; only a new step dispatches. */
  const onDragControl = (componentId: string, t: number) => {
    const control = definition?.fidelity?.components.find((candidate) => candidate.id === componentId)?.control;
    if (!control || !definition?.fidelity) return;
    setState((current) => {
      const action = current.fidelity ? dragAction(definition.fidelity!, current.fidelity, control, t) : null;
      if (!action) return current;
      const result = acceptLabAction(definition, current, action);
      return result.ok ? result.state : current;
    });
  };
  // RX-005d camera rails and Recentre (presentation only; each rail stop is an ordinary camera-preset action).
  const [rail, setRail] = useState<RailPosition | null>(null);
  const [cameraLeg, setCameraLeg] = useState<CameraLeg>(DEFAULT_LEG);
  const [recenter, setRecenter] = useState(0);
  // A18: the view of the current preset carries over when the renderer changes profile.
  const cameraPose = useRef<{ presetId: string; pose: CameraPose } | null>(null);
  const onPoseChange = useCallback((presetId: string, pose: CameraPose) => { cameraPose.current = { presetId, pose }; }, []);
  const goToRailStop = (position: RailPosition) => {
    const stop = definition?.fidelity ? railStop(definition.fidelity, position) : null;
    if (!stop) { setRail(null); return; }
    setRail(position); setCameraLeg(stop.leg);
    dispatch({ type: "camera-preset", presetId: stop.presetId });
  };
  const startRail = (railId: string) => goToRailStop({ railId, index: 0 });
  const nextRailStop = () => { if (!rail || !definition?.fidelity) return; const next = advanceRail(definition.fidelity, rail); if (next) goToRailStop(next); else { setRail(null); setCameraLeg(DEFAULT_LEG); } };
  const skipRail = () => { if (!rail || !definition?.fidelity) return; const stops = findRail(definition.fidelity, rail.railId)?.stops ?? []; if (stops.length) goToRailStop({ railId: rail.railId, index: stops.length - 1 }); setRail(null); setCameraLeg(DEFAULT_LEG); };
  // A guided step that names a rail starts it.
  const guidedRailId = state.mode === "GUIDED" && definition?.fidelity && state.fidelity ? definition.fidelity.guidedPath[state.fidelity.guidedStepIndex]?.railId : undefined;
  const startedGuidedRail = useRef<string | null>(null);
  useEffect(() => {
    if (!guidedRailId) { startedGuidedRail.current = null; return; }
    if (startedGuidedRail.current === guidedRailId) return;
    startedGuidedRail.current = guidedRailId;
    startRail(guidedRailId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per guided step that names a rail
  }, [guidedRailId]);
  /** A14: → advances the rail only while the scene itself has focus (no control focused). */
  const onSceneKeyDownCapture = (event: React.KeyboardEvent) => {
    if (!rail || event.key !== "ArrowRight" || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (!target.matches?.("[data-lab-renderer][tabindex]")) return;
    event.preventDefault(); event.stopPropagation(); nextRailStop();
  };
  const activeCheck = checks.find((check) => !state.completedChecks.includes(check.id));
  useEffect(() => {
    // A17: the controls column sits beside the scene on desktop and on a phone in landscape; otherwise a bottom sheet.
    const desktop = window.matchMedia(`(min-width: 1024px), ${PHONE_LANDSCAPE_QUERY}`);
    const sync = () => setSheetMode(!desktop.matches);
    sync(); desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  const progress = Math.round(state.completedChecks.length / Math.max(checks.length, 1) * 100);
  const traceFlowId = activeCheck?.fidelity?.kind === "trace-path" ? activeCheck.fidelity.flowId : null;
  const onPick = (pick: ScenePick) => {
    if (pick.kind === "node") dispatch({ type: "trace-node", flowId: pick.flowId, nodeId: pick.nodeId });
    // RX-005c tap rule: tapping a control part operates it (same set-variable as the panel twin); a disabled
    // control does nothing. Inspecting a control part goes through the parts list.
    else if (pick.item.control) activateControlPart(pick.item.id);
    else if (pick.item.kind === "object") dispatch({ type: "select", objectId: pick.item.id });
    else dispatch({ type: "inspect-component", componentId: pick.item.id });
  };
  const onDowngrade = (reason: "context" | "performance" | "creation") => {
    setProfile((current) => {
      // A lost context goes to 2D (A5); a renderer that cannot be created falls to the LOW pass (R4 P1-3).
      const next = reason === "context" ? "FALLBACK_2D" : reason === "creation" ? "LOW" : downgradeProfile(current);
      downgradePath.current = [...downgradePath.current, `${current}>${next}:${reason}`];
      rememberProfile(getProfileStorage(), next);
      // Any forced downgrade blocks later auto-upgrades, so the lab cannot cycle back to a renderer that failed.
      performanceDowngraded.current = true; rememberPerformanceDowngrade(getProfileStorage());
      return next;
    });
    // A18: one non-modal notice; camera, selection, rail position and a pending confirm carry over (they live here).
    setNotice(reason === "context" ? "Switched to lighter graphics: 3D is not available on this device, so the lab shows the 2D view." : reason === "creation" ? "Switched to lighter graphics: detailed 3D is not available on this device." : "Switched to lighter graphics to keep things smooth.");
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
    downgradePath.current = [...downgradePath.current, `${profile}>${next}:load`];
    setProfile(next);
    rememberProfile(getProfileStorage(), next);
    // R4 P1-2: a failed chunk must not be retried by the LOW probe's auto-upgrade (an offline loop).
    performanceDowngraded.current = true; rememberPerformanceDowngrade(getProfileStorage());
    setNotice(next === "LOW" ? "Switched to lighter graphics: the detailed graphics could not load." : "Switched to lighter graphics: 3D graphics could not load, so the lab shows the 2D view.");
  }, [profile]);

  if (!definition || (!reviewPreview && (definition.reviewState !== "APPROVED" || definition.approvalState !== "APPROVED"))) return <p className="p-6">This lab is not available.</p>;

  if (intro) return <section className="mx-auto max-w-5xl rounded-3xl bg-slate-950 p-8 text-white shadow-2xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-cyan-300">Interactive lab</p><h1 className="mt-3 text-3xl font-bold">{definition.title ?? "Interactive lab"}</h1><p className="mt-4 max-w-2xl text-slate-300">{definition.summary ?? "Use the scene to complete the checks."}</p><button type="button" onClick={() => setIntro(false)} className="mt-7 rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950">Start exploring</button></section>;

  const controlsBody = (
    <>
      <LabControlPanel definition={definition} state={state} activeCheck={activeCheck} dispatch={dispatch} onStartRail={startRail} />
      <div className="mt-8 flex gap-2">
        {confirmRestart
          ? <>
              <button type="button" onClick={() => { setConfirmRestart(false); dispatch({ type: "reset" }); }} className="min-h-11 rounded-full border border-red-300 bg-red-700 px-4 py-2 text-sm font-bold text-white">Yes, restart the lab</button>
              <button type="button" onClick={() => setConfirmRestart(false)} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm">Keep my progress</button>
            </>
          : <button type="button" onClick={() => setConfirmRestart(true)} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm">Restart lab (clears progress)</button>}
        {definition.scene.objects.length > 0 && <button type="button" onClick={() => dispatch({ type: "focus", objectId: state.selectedObjectId ?? definition.scene.objects[0].id })} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm">Focus</button>}
      </div>
    </>
  );

  return (
    <section style={sheetMode ? { paddingBottom: `${Math.max(176, Math.ceil(peekHeight) + 16)}px` } : undefined} data-lab-active-profile={profile} data-lab-downgrade-path={downgradePath.current.join(" ")} className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Grade {definition.grade} · {definition.subject[0] + definition.subject.slice(1).toLowerCase()}</p><h1 className="text-xl font-bold">{definition.title ?? definition.id}</h1></div>
        <div className="flex items-center gap-2 text-sm">
          <span>{progress}% complete</span>
          <label className="sr-only" htmlFor="profile">Visual quality</label>
          <select id="profile" value={profile} onChange={(event) => { const next = event.target.value as CapabilityProfile; manualProfileChoice.current = true; setNotice(null); rememberProfile(getProfileStorage(), next); setProfile(next); }} className="min-h-11 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white"><option>HIGH</option><option>STANDARD</option><option>LOW</option><option>FALLBACK_2D</option></select>
        </div>
      </div>
      {notice && <p role="status" className="border-b border-white/10 bg-amber-300/10 px-5 py-2 text-xs text-amber-100">{notice}</p>}
      {/* Keyboard users skip the scene's focusable parts (every part is a button in the 2D view). */}
      <a href="#lab-controls" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-slate-950">Skip to lab controls</a>
      <div className="grid gap-0 lg:grid-cols-[1fr_340px] [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[60%_40%]">
        <div onKeyDownCapture={onSceneKeyDownCapture}
          onKeyDown={(event) => { if (event.key === "Escape" && pendingControl) { event.preventDefault(); setPendingControl(null); } }}
          onBlur={(event) => { if (pendingControl && !event.currentTarget.contains(event.relatedTarget as Node | null)) setPendingControl(null); }}
          className={`relative min-w-0 ${definition.fidelity?.environment === "DAYLIGHT" ? "bg-[linear-gradient(#dbeafe,#f1f5f9_58%,#dce7d4)] text-slate-900" : definition.fidelity?.environment === "DARK_FIELD" ? "bg-[#02040a]" : "bg-[radial-gradient(circle_at_50%_38%,#263d72,#080d20_68%)]"}`}>
          {profile === "FALLBACK_2D"
            ? <Fallback2D definition={definition} state={state} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} pendingControlId={pendingControl?.componentId ?? null} onDragControl={onDragControl} />
            : <SceneLoadBoundary key={profile} onError={onRendererLoadError} fallback={<Fallback2D definition={definition} state={state} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} pendingControlId={pendingControl?.componentId ?? null} onDragControl={onDragControl} />}>
                {profile === "HIGH" || profile === "STANDARD"
                  ? <ThreeScene definition={definition} state={state} profile={profile} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} onDowngrade={onDowngrade} onUpgradeReady={onUpgradeReady} onReady={onSceneReady} allowProfileUpgrade={canUpgrade} allowPerformanceDowngrade={!reviewPreview} review={!!reviewPreview} cameraLeg={cameraLeg} recenter={recenter} initialPose={cameraPose.current} onPoseChange={onPoseChange} pendingControlId={pendingControl?.componentId ?? null} onDragControl={onDragControl} />
                  : <WebGLScene definition={definition} state={state} profile={profile} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} onDowngrade={onDowngrade} onUpgradeReady={onUpgradeReady} onReady={onSceneReady} allowProfileUpgrade={canUpgrade} allowPerformanceDowngrade={!reviewPreview} review={!!reviewPreview} railActive={!!rail} recenter={recenter} initialPose={cameraPose.current} pendingControlId={pendingControl?.componentId ?? null} onDragControl={onDragControl} />}
              </SceneLoadBoundary>}
          {profile !== "FALLBACK_2D" && <button type="button" onClick={() => setRecenter((value) => value + 1)} className="absolute right-2 top-2 z-20 min-h-11 rounded-full border border-white/25 bg-slate-950/75 px-3 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Recentre</button>}
          {profile !== "FALLBACK_2D" && !sceneReady && <SceneLoadingVeil label={profile === "LOW" ? "Loading the 3D lab…" : "Loading the high-quality 3D lab…"}><Fallback2D definition={definition} state={state} reducedMotion={reducedMotion} traceFlowId={traceFlowId} dispatch={dispatch} onPick={onPick} /></SceneLoadingVeil>}
          {rail && definition.fidelity && <CameraRailBar spec={definition.fidelity} position={rail} onNext={nextRailStop} onSkip={skipRail} />}
          <SceneHud definition={definition} state={state} dispatch={dispatch} />
          {pendingControl && <div data-lab-pending-control={pendingControl.componentId} className="flex flex-wrap items-center gap-2 border-t border-amber-200/40 bg-slate-900 px-3 py-2 text-sm text-white">
            <span className="font-bold">Confirm? {pendingControl.label}</span>
            <button type="button" onClick={() => activateControlPart(pendingControl.componentId)} className="min-h-11 rounded-full bg-amber-300 px-4 text-xs font-bold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Confirm</button>
            <button type="button" onClick={() => setPendingControl(null)} className="min-h-11 rounded-full border border-white/30 px-4 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Cancel</button>
          </div>}
          {/* A14: one live region mounted for the player's lifetime, so the pending confirm is reliably announced. */}
          <p aria-live="assertive" className="sr-only">{pendingControl ? `Confirm? ${pendingControl.label}` : ""}</p>
          <SceneControlBar definition={definition} state={state} dispatch={dispatch} pendingControlId={pendingControl?.componentId ?? null} onActivate={activateControlPart} />
        </div>
        {sheetMode
          ? <MobileSheet definition={definition} state={state} activeCheck={activeCheck} snap={sheetSnap} onSnap={setSheetSnap} onPeekHeight={setPeekHeight}><div className="p-5">{controlsBody}</div></MobileSheet>
          : <aside id="lab-controls" aria-label="Lab controls" className="min-w-0 border-l border-white/10 bg-white/[.03] p-5 lg:max-h-[clamp(420px,62vh,640px)] lg:overflow-y-auto [@media(orientation:landscape)_and_(max-height:500px)]:max-h-[calc(100dvh-4.5rem)] [@media(orientation:landscape)_and_(max-height:500px)]:overflow-y-auto">{controlsBody}</aside>}
      </div>
    </section>
  );
}
