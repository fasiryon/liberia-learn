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
    // ES2020 stable sort retains the deterministic row/column order for equal distances.
    candidates.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y));
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
    line.style.cssText = `left:${Math.round(anchor.x)}px;top:${Math.round(anchor.y)}px;width:${Math.round(Math.hypot(center.x - anchor.x, center.y - anchor.y))}px;transform:rotate(${Math.atan2(center.y - anchor.y, center.x - anchor.x)}rad)`;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.labHitProxy = item.id;
    button.dataset.partId = item.id;
    const control = item.control!;
    button.setAttribute("aria-label", control.pending ? `Confirm? ${item.label}` : item.label);
    button.setAttribute("aria-disabled", String(!control.action));
    if (control.kind !== "step-variable") button.setAttribute("aria-pressed", String(control.selected));
    button.textContent = control.pending ? "Confirm?" : control.label;
    button.className = "pointer-events-auto absolute rounded-lg border-2 border-slate-900 bg-amber-100 text-center text-[10px] leading-tight text-slate-950 focus-visible:outline focus-visible:outline-white";
    button.style.cssText = `width:${CONTROL_TARGET_SIZE}px;height:${CONTROL_TARGET_SIZE}px;left:${Math.round(center.x - CONTROL_TARGET_SIZE / 2)}px;top:${Math.round(center.y - CONTROL_TARGET_SIZE / 2)}px`;
    button.onpointerdown = (event) => event.stopPropagation();
    button.onclick = (event) => { event.stopPropagation(); if (control.action) onPick({ kind: "item", item }); };
    return [line, button];
  });
}
