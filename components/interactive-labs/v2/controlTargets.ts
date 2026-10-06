import type { RenderItem } from "@/lib/interactive-labs/v2/fidelity/renderList";
import type { Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";
import type { ScenePick } from "./picking";

export const CONTROL_TARGET_SIZE = 44;
const GAP = 4;
type Point = { x: number; y: number };
type ProtectedRect = { left: number; right: number; top: number; bottom: number };
export type ControlTarget = { item: RenderItem; anchor: Point; center: Point };

/** Screen-space hit proxies, never model geometry. Stable order and disjoint 44px squares. */
export function layoutControlTargets(items: readonly RenderItem[], project: (point: Vec3) => Point | null, width: number, height: number, availableHeight = height, protectedRects: ProtectedRect[] = []): ControlTarget[] {
  if (width < CONTROL_TARGET_SIZE || availableHeight < CONTROL_TARGET_SIZE) return [];
  const targets: ControlTarget[] = [];
  const half = CONTROL_TARGET_SIZE / 2;
  const clamp = (n: number, max: number) => Math.max(half, Math.min(max - half, n));
  for (const item of items.filter((part) => part.control && !part.control.dragAxis && part.inFocus && part.selectable)) {
    const anchor = project(item.center);
    if (!anchor || anchor.x < 0 || anchor.x > width || anchor.y < 0 || anchor.y > height) continue;
    const candidates: Point[] = [{ x: clamp(anchor.x, width), y: clamp(anchor.y, availableHeight) }];
    for (let y = half; y <= availableHeight - half; y += CONTROL_TARGET_SIZE + GAP) {
      for (let x = half; x <= width - half; x += CONTROL_TARGET_SIZE + GAP) candidates.push({ x, y });
    }
    candidates.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y) || a.y - b.y || a.x - b.x);
    const center = candidates.find((candidate) => protectedRects.every((rect) => candidate.x + half + GAP <= rect.left || candidate.x - half - GAP >= rect.right || candidate.y + half + GAP <= rect.top || candidate.y - half - GAP >= rect.bottom) && targets.every((target) => Math.abs(candidate.x - target.center.x) >= CONTROL_TARGET_SIZE + GAP || Math.abs(candidate.y - target.center.y) >= CONTROL_TARGET_SIZE + GAP));
    if (center) targets.push({ item, anchor, center });
  }
  return targets;
}

/** All renderers use the same labelled phone controls and action path. Docked twins remain keyboard alternatives. */
export function controlTargetElements(items: readonly RenderItem[], project: (point: Vec3) => Point | null, width: number, height: number, onPick: (pick: ScenePick) => void, stageTop = 0, stageLeft = 0): HTMLElement[] {
  if (!window.matchMedia("(max-width: 1023px)").matches) return [];
  const sheetTop = document.querySelector("[data-lab-sheet]")?.getBoundingClientRect().top ?? window.innerHeight;
  const availableHeight = Math.min(height, window.innerHeight - stageTop, sheetTop - stageTop);
  const protectedRects = Array.from(document.querySelectorAll("[data-lab-scene-label]")).map(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left - stageLeft, right: rect.right - stageLeft, top: rect.top - stageTop, bottom: rect.bottom - stageTop };
  });
  return layoutControlTargets(items, project, width, height, availableHeight, protectedRects).flatMap(({ item, anchor, center }) => {
    const line = document.createElement("span");
    line.setAttribute("aria-hidden", "true");
    line.className = "pointer-events-none absolute origin-left border-t-2 border-slate-900";
    line.style.left = `${Math.round(anchor.x)}px`; line.style.top = `${Math.round(anchor.y)}px`;
    line.style.width = `${Math.round(Math.hypot(center.x - anchor.x, center.y - anchor.y))}px`;
    line.style.transform = `rotate(${Math.atan2(center.y - anchor.y, center.x - anchor.x)}rad)`;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.labHitProxy = item.id;
    button.dataset.partId = item.id;
    button.setAttribute("aria-label", item.control!.pending ? `Confirm? ${item.label}` : item.label);
    button.setAttribute("aria-disabled", String(!item.control!.action));
    if (item.control!.kind !== "step-variable") button.setAttribute("aria-pressed", String(item.control!.selected));
    button.title = item.label;
    button.textContent = item.control!.pending ? "Confirm?" : item.control!.label;
    button.className = "pointer-events-auto absolute z-30 flex items-center justify-center overflow-hidden rounded-lg border-2 border-slate-900 bg-amber-100 p-0.5 text-center text-[10px] font-bold leading-tight text-slate-950 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";
    button.style.width = `${CONTROL_TARGET_SIZE}px`; button.style.height = `${CONTROL_TARGET_SIZE}px`;
    button.style.left = `${Math.round(center.x - CONTROL_TARGET_SIZE / 2)}px`; button.style.top = `${Math.round(center.y - CONTROL_TARGET_SIZE / 2)}px`;
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => { event.stopPropagation(); if (item.control!.action) onPick({ kind: "item", item }); });
    return [line, button];
  });
}
