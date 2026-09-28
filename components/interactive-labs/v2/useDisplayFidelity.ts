"use client";
import { useEffect, useRef, useState } from "react";
import type { InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";
import type { FidelityState } from "@/lib/interactive-labs/v2/fidelity/types";
import { easeDisplayState, isSettled } from "@/lib/interactive-labs/v2/fidelity/presentation";

/**
 * Eases the displayed fidelity state toward the lab state and exposes a clock for flow particles.
 * The loop runs only while something is animating, so an idle 2D scene costs nothing.
 */
export function useDisplayFidelity(definition: InteractiveLabDefinition<LabState>, state: LabState, reducedMotion: boolean, animateFlows: boolean) {
  const spec = definition.fidelity;
  const [display, setDisplay] = useState<FidelityState | undefined>(state.fidelity);
  const [time, setTime] = useState(0);
  const displayRef = useRef(display);
  useEffect(() => {
    if (!spec || !state.fidelity) { setDisplay(state.fidelity); return; }
    const target = state.fidelity;
    let frame = 0, last = performance.now(), lastPaint = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      const next = easeDisplayState(spec, displayRef.current ?? target, target, dt, reducedMotion);
      displayRef.current = next;
      const settled = isSettled(next, target);
      // ~30 fps is plenty for SVG and keeps low-end devices cool.
      if (now - lastPaint > 33 || settled) { lastPaint = now; setDisplay(next); if (animateFlows && !reducedMotion) setTime(now / 1000); }
      if (!settled || (animateFlows && !reducedMotion)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spec, state.fidelity, reducedMotion, animateFlows]);
  return { display, time };
}
