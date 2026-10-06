// RX-005 A4/A6 and RX-006 (R3P-005, R3P-006): when a lab scene may spend frames. Both WebGL renderers share it.
// - Paused while the page is hidden or the scene is off-screen (IntersectionObserver).
// - Ambient-only frames (surface scroll, spin, particles, pulse) are capped at 30 fps; camera moves and eases run at
//   the display rate.
// - The downgrade sampler measures the display cadence (one sample per scheduled animation frame), so a capped
//   ambient loop on a healthy device never reads as a slow device.

/** A6: the ambient-only frame interval (30 fps). */
export const AMBIENT_FRAME_INTERVAL_MS = 1000 / 30;
/** rAF timestamps jitter by a fraction of a millisecond; a frame within this of the interval is due. */
const AMBIENT_JITTER_MS = 1.5;

/** Whether a frame whose only motion is ambient should draw now, given when the last frame was drawn. */
export function ambientFrameDue(nowMs: number, lastDrawnAtMs: number): boolean {
  return nowMs - lastDrawnAtMs >= AMBIENT_FRAME_INTERVAL_MS - AMBIENT_JITTER_MS;
}

export type FrameMotion = { ambient: boolean; eased: boolean };
/** Draw every frame while something eases (camera, display state); throttle frames that only carry ambient motion. */
export function shouldDrawFrame(motion: FrameMotion, nowMs: number, lastDrawnAtMs: number): boolean {
  return motion.eased || !motion.ambient || ambientFrameDue(nowMs, lastDrawnAtMs);
}

type VisibilityDocument = { hidden: boolean; addEventListener: (type: "visibilitychange", listener: () => void) => void; removeEventListener: (type: "visibilitychange", listener: () => void) => void };
type ObserverConstructor = new (callback: (entries: { isIntersecting: boolean }[]) => void, options?: { threshold?: number }) => { observe: (target: Element) => void; disconnect: () => void };

/**
 * Report whether the scene can be seen: the page is visible and the element intersects the viewport. Starts active
 * (so the first frame is never blank) until the observer reports otherwise. Returns a disposer.
 */
export function watchSceneVisibility(element: Element, onChange: (active: boolean) => void, deps: { document: VisibilityDocument; IntersectionObserver?: ObserverConstructor }): () => void {
  let intersecting = true, active = !deps.document.hidden;
  const update = () => {
    const next = intersecting && !deps.document.hidden;
    if (next !== active) { active = next; onChange(active); }
  };
  const onVisibility = () => update();
  deps.document.addEventListener("visibilitychange", onVisibility);
  const observer = deps.IntersectionObserver ? new deps.IntersectionObserver((entries) => { const entry = entries[entries.length - 1]; if (entry) { intersecting = entry.isIntersecting; update(); } }, { threshold: 0 }) : null;
  observer?.observe(element);
  if (!active) onChange(false);
  return () => { deps.document.removeEventListener("visibilitychange", onVisibility); observer?.disconnect(); };
}

/** Browser dependencies for watchSceneVisibility (IntersectionObserver is optional on very old WebViews). */
export function browserVisibilityDeps() {
  return { document, IntersectionObserver: typeof IntersectionObserver === "function" ? IntersectionObserver as unknown as ObserverConstructor : undefined };
}
