"use client";
import { useEffect, useRef, useState } from "react";
import type { InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";
import type { FidelityState } from "@/lib/interactive-labs/v2/fidelity/types";
import { deriveSimulation } from "@/lib/interactive-labs/v2/fidelity/engine";
import { easeDisplayState, isSettled } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { shouldDrawFrame } from "@/lib/interactive-labs/v2/fidelity/sceneActivity";

/**
 * Eases the displayed fidelity state toward the lab state and exposes a clock for flow particles.
 * The loop runs only while something is animating and the scene can be seen (`active`, RX-005 A6), so an idle or
 * off-screen scene costs nothing. Eases publish every frame; ambient-only motion publishes at most 30 times a second.
 */
export function useDisplayFidelity(definition: InteractiveLabDefinition<LabState>, state: LabState, reducedMotion: boolean, animateFlows: boolean, active = true) {
  const spec = definition.fidelity;
  const [display, setDisplay] = useState<FidelityState | undefined>(state.fidelity);
  const [time, setTime] = useState(0);
  const displayRef = useRef(display);
  useEffect(() => {
    if (!spec || !state.fidelity) { setDisplay(state.fidelity); return; }
    if (!active) return;
    const target = state.fidelity;
    const simulation = deriveSimulation(spec, target);
    const hasActiveVisibleFlow = animateFlows && !reducedMotion && spec.flows.some((flow) =>
      !target.hiddenFlowIds.includes(flow.id) && simulation.flows[flow.id]?.active);
    let frame = 0, last = performance.now(), lastPaint = 0;
    let lastReviewTime: number | undefined, reviewClockSeen = false, lastPublishedReviewTime: number | undefined;
    const tick = (now: number) => {
      if (typeof window !== "undefined" && (window as Window & { __labReview?: unknown }).__labReview) {
        (window as Window & { __labReviewClockReady?: boolean }).__labReviewClockReady = true;
      }
      const reviewTime = typeof window === "undefined" ? undefined : (window as Window & { __labReviewClockSeconds?: number }).__labReviewClockSeconds;
      const renderTime = reviewTime === undefined ? now : reviewTime * 1000;
      if (reviewTime !== undefined && !reviewClockSeen) { lastPaint = renderTime - 34; reviewClockSeen = true; }
      const dt = reviewTime === undefined ? (now - last) / 1000 : lastReviewTime === undefined ? 0 : Math.max(0, (renderTime - lastReviewTime) / 1000);
      last = now;
      if (reviewTime !== undefined) lastReviewTime = renderTime;
      const next = easeDisplayState(spec, displayRef.current ?? target, target, dt, reducedMotion);
      displayRef.current = next;
      const settled = isSettled(next, target);
      // Review captures use authored timestamps and must publish each one exactly. The learner path publishes every
      // easing frame, caps ambient-only flow motion at 30 fps, and stops ticking once settled with no visible active flow.
      // Under a held review clock, time does not advance, so easing cannot progress (an open assembly's context fade
      // never settles at dt = 0). Republishing would only make the scene redraw every frame and starve the capture;
      // publish only when the review time actually moves.
      const publish = reviewTime !== undefined
        ? renderTime !== lastPublishedReviewTime
        : shouldDrawFrame({ ambient: hasActiveVisibleFlow, eased: !settled }, renderTime, lastPaint);
      if (publish) { lastPaint = renderTime; if (reviewTime !== undefined) lastPublishedReviewTime = renderTime; setDisplay(next); if (hasActiveVisibleFlow) setTime(reviewTime ?? now / 1000); }
      if (!settled || hasActiveVisibleFlow || reviewTime !== undefined) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spec, state.fidelity, reducedMotion, animateFlows, active]);
  return { display, time };
}
