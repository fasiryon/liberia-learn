// A15 static cues as DOM overlay (zero GPU cost, sharp at any DPR, identical on HIGH, STANDARD and LOW): a direction
// chevron rotated to the projected flow direction, or a glyph. Decorative duplicates of state the panel and HUD state in
// text, so they are hidden from assistive technology.
import type { RenderCue } from "@/lib/interactive-labs/v2/fidelity/emitters";
import type { Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";
import { HIGHLIGHT_COLOR } from "@/lib/interactive-labs/v2/fidelity/palette";

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
    node.style.left = `${Math.round(at.x)}px`; node.style.top = `${Math.round(at.y)}px`;
    node.style.transform = `translate(-50%, -50%)${cue.kind === "chevron" ? ` rotate(${angle.toFixed(3)}rad)` : ""}`;
    return [node];
  });
}

/** The parts whose status glyph is drawn in the scene: visible, instructional status lamps (A19 / G3). */
export const statusBadgeItems = <T extends { status?: { glyph: string; text: string }; inFocus: boolean; selectable: boolean; detail?: "decor" }>(items: readonly T[]) =>
  items.filter((item) => item.status && item.inFocus && item.selectable && item.detail !== "decor");

/**
 * A19 / G3: each status lamp's glyph beside it, so its state is never colour alone. Decorative (the HUD states every
 * lamp in text), so hidden from assistive technology.
 */
export function statusBadgeElements(items: readonly { id: string; center: Vec3; status?: { glyph: string; text: string }; inFocus: boolean; selectable: boolean; detail?: "decor" }[], project: Project): HTMLElement[] {
  return statusBadgeItems(items).flatMap((item) => {
    const at = project(item.center);
    if (!at) return [];
    const node = document.createElement("span");
    node.textContent = item.status!.glyph;
    node.title = item.status!.text;
    node.dataset.labStatus = item.id;
    node.setAttribute("aria-hidden", "true");
    node.className = "pointer-events-none absolute flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-950/85 px-1 text-lg font-black leading-none text-white ring-1 ring-white/60";
    node.style.left = `${Math.round(at.x)}px`; node.style.top = `${Math.round(at.y) + 16}px`;
    node.style.transform = "translate(-50%, -50%)";
    return [node];
  });
}

type ControlItem = { id: string; center: Vec3; inFocus: boolean; selectable: boolean; control?: { pending: boolean; dragAxis?: [Vec3, Vec3] } };

/** A14 shared control-affordance glyph: a dot for tap controls, an arrow along the drag axis for drag controls. */
export function controlGlyph(control: { dragAxis?: [Vec3, Vec3] }): string {
  if (!control.dragAxis) return "◉";
  const [a, b] = control.dragAxis;
  return Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]) ? "↕" : "↔";
}

/**
 * A14 control affordance on HIGH/STANDARD/LOW: a ring with the control glyph on every visible control part, and a
 * "Confirm?" label (highlight token, no state token) on a part whose confirm preview is pending. Decorative: the chip
 * twins carry the names and the pending state for assistive technology.
 */
export function controlAffordanceElements(items: readonly ControlItem[], project: Project): HTMLElement[] {
  return items.filter((item) => item.control && item.inFocus && item.selectable).flatMap((item) => {
    const at = project(item.center);
    if (!at) return [];
    const ring = document.createElement("span");
    ring.textContent = controlGlyph(item.control!);
    ring.dataset.labControlAffordance = item.id;
    ring.setAttribute("aria-hidden", "true");
    // Tap controls have phone proxies; drag controls retain their original directional affordance.
    ring.className = `lab-control-affordance${item.control!.dragAxis ? "" : " max-[1023px]:opacity-0"}`;
    ring.style.borderColor = item.control!.pending ? HIGHLIGHT_COLOR : "#fcd34d";
    ring.style.left = `${Math.round(at.x)}px`; ring.style.top = `${Math.round(at.y)}px`; ring.style.transform = "translate(-50%, -50%)";
    if (!item.control!.pending) return [ring];
    const label = document.createElement("span");
    label.textContent = "Confirm?";
    label.dataset.labPendingLabel = item.id;
    label.setAttribute("aria-hidden", "true");
    label.className = "pointer-events-none absolute whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold text-slate-950";
    label.style.background = HIGHLIGHT_COLOR;
    label.style.left = `${Math.round(at.x)}px`; label.style.top = `${Math.round(at.y) - 22}px`; label.style.transform = "translate(-50%, -100%)";
    return [ring, label];
  });
}

/** A14 cursor over a scene part: grab for drag controls, pointer for tap controls, default elsewhere. */
export const controlCursor = (control: { dragAxis?: unknown } | undefined): string => !control ? "" : control.dragAxis ? "grab" : "pointer";
