// A15 static cues as DOM overlay (zero GPU cost, sharp at any DPR, identical on HIGH, STANDARD and LOW): a direction
// chevron rotated to the projected flow direction, or a glyph. Decorative duplicates of state the panel and HUD state in
// text, so they are hidden from assistive technology.
import type { RenderCue } from "@/lib/interactive-labs/v2/fidelity/emitters";
import type { Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";

type Project = (point: Vec3) => { x: number; y: number } | null;

export function cueElements(cues: readonly RenderCue[], project: Project): HTMLElement[] {
  return cues.flatMap((cue) => {
    const at = project(cue.position);
    if (!at) return [];
    const ahead = project([cue.position[0] + cue.direction[0] * 0.4, cue.position[1] + cue.direction[1] * 0.4, cue.position[2] + cue.direction[2] * 0.4]);
    const angle = ahead ? Math.atan2(ahead.y - at.y, ahead.x - at.x) : 0;
    const node = document.createElement("span");
    node.textContent = cue.kind === "glyph" ? cue.glyph ?? "•" : "➤";
    node.dataset.labCue = cue.id;
    node.setAttribute("aria-hidden", "true");
    node.className = "pointer-events-none absolute text-sm font-black leading-none [text-shadow:0_0_2px_#0f172a,0_0_2px_#0f172a]";
    node.style.color = cue.color;
    node.style.left = `${at.x}px`; node.style.top = `${at.y}px`;
    node.style.transform = `translate(-50%, -50%)${cue.kind === "chevron" ? ` rotate(${angle.toFixed(3)}rad)` : ""}`;
    return [node];
  });
}
