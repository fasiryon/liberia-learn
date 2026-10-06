"use client";
import { useEffect, useState, type RefObject } from "react";
import { browserVisibilityDeps, watchSceneVisibility } from "@/lib/interactive-labs/v2/fidelity/sceneActivity";

/**
 * RX-005 A6: false while the page is hidden or the scene is scrolled off-screen, so the renderer spends no frames.
 * Review captures pin it on: full-page screenshots must never catch a paused scene.
 */
export function useSceneActive(ref: RefObject<Element | null>, alwaysActive = false): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (alwaysActive || !element) { setActive(true); return; }
    return watchSceneVisibility(element, setActive, browserVisibilityDeps());
  }, [ref, alwaysActive]);
  return active;
}
