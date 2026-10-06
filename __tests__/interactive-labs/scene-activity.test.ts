import { describe, expect, it } from "vitest";
import { ambientFrameDue, AMBIENT_FRAME_INTERVAL_MS, shouldDrawFrame, watchSceneVisibility } from "@/lib/interactive-labs/v2/fidelity/sceneActivity";
import { recordFrameSample, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { downgradeFrameBudgetMs } from "@/lib/interactive-labs/v2/production/budgets";
import type { CapabilityProfile } from "@/lib/interactive-labs/v2/types";

/** Drive the shared loop policy at a display cadence and return the downgrade samples and the drawn frame times. */
function runLoop(displayMs: number, frames: number, motion: { ambient: boolean; eased: boolean }) {
  let samples: number[] = [], lastDrawn = -Infinity, previous: number | null = null;
  const drawn: number[] = [];
  for (let index = 0; index < frames; index += 1) {
    const now = index * displayMs;
    if (previous !== null) samples = recordFrameSample(samples, now - previous, true);
    previous = now;
    if (shouldDrawFrame(motion, now, lastDrawn)) { drawn.push(now); lastDrawn = now; }
  }
  return { samples, drawn };
}

describe("RX-005 A6: 30 fps ambient cap", () => {
  it("draws ambient-only frames at most every 33 ms, and eases at the display rate", () => {
    const ambient = runLoop(1000 / 60, 120, { ambient: true, eased: false });
    const gaps = ambient.drawn.slice(1).map((time, index) => time - ambient.drawn[index]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(AMBIENT_FRAME_INTERVAL_MS - 1.5);
    expect(ambient.drawn.length).toBeGreaterThanOrEqual(58);
    expect(ambient.drawn.length).toBeLessThanOrEqual(61);
    expect(runLoop(1000 / 60, 120, { ambient: true, eased: true }).drawn).toHaveLength(120);
    expect(runLoop(1000 / 60, 120, { ambient: false, eased: false }).drawn).toHaveLength(120);
    expect(ambientFrameDue(100, 100 - AMBIENT_FRAME_INTERVAL_MS)).toBe(true);
    expect(ambientFrameDue(100, 90)).toBe(false);
  });
});

describe("RX-005 A4: the downgrade sampler", () => {
  it("does not downgrade a healthy device running the capped ambient loop, on any profile", () => {
    for (const display of [1000 / 60, 1000 / 90, 1000 / 120]) {
      const { samples } = runLoop(display, 200, { ambient: true, eased: false });
      for (const profile of ["HIGH", "STANDARD", "LOW"] as CapabilityProfile[]) expect(shouldDowngrade(samples, downgradeFrameBudgetMs(profile)), `${profile} @ ${display.toFixed(1)} ms`).toBe(false);
    }
  });

  it("would have downgraded HIGH if the cap were measured as the device cadence (why samples follow the display)", () => {
    let samples: number[] = [];
    for (let index = 0; index < 120; index += 1) samples = recordFrameSample(samples, AMBIENT_FRAME_INTERVAL_MS, true);
    expect(shouldDowngrade(samples, downgradeFrameBudgetMs("HIGH"))).toBe(true);
  });

  it("still downgrades a device that is genuinely slow while capped", () => {
    const { samples } = runLoop(48, 200, { ambient: true, eased: false });
    expect(shouldDowngrade(samples, downgradeFrameBudgetMs("HIGH"))).toBe(true);
  });

  it("does not sample across an idle gap", () => {
    let samples: number[] = [];
    for (let index = 0; index < 59; index += 1) samples = recordFrameSample(samples, 16.7, true);
    samples = recordFrameSample(samples, 4000, false);
    for (let index = 0; index < 59; index += 1) samples = recordFrameSample(samples, 16.7, true);
    expect(shouldDowngrade(samples, downgradeFrameBudgetMs("HIGH"))).toBe(false);
  });
});

describe("RX-005 A6: pause when hidden or off-screen", () => {
  function fakes() {
    const listeners = new Set<() => void>();
    const doc = { hidden: false, addEventListener: (_: "visibilitychange", listener: () => void) => { listeners.add(listener); }, removeEventListener: (_: "visibilitychange", listener: () => void) => { listeners.delete(listener); } };
    let callback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    let disconnected = false, observed: Element | null = null;
    class FakeObserver { constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { callback = cb; } observe(target: Element) { observed = target; } disconnect() { disconnected = true; } }
    return { doc, listeners, FakeObserver, emit: (isIntersecting: boolean) => callback?.([{ isIntersecting }]), state: () => ({ disconnected, observed }) };
  }

  it("reports off-screen and hidden-page as inactive, and resumes when both clear", () => {
    const f = fakes(), element = {} as Element, changes: boolean[] = [];
    const stop = watchSceneVisibility(element, (active) => changes.push(active), { document: f.doc, IntersectionObserver: f.FakeObserver });
    expect(f.state().observed).toBe(element);
    f.emit(false); f.emit(true);
    f.doc.hidden = true; f.listeners.forEach((listener) => listener());
    f.emit(false);
    f.doc.hidden = false; f.listeners.forEach((listener) => listener());
    f.emit(true);
    expect(changes).toEqual([false, true, false, true]);
    stop();
    expect(f.state().disconnected).toBe(true);
    expect(f.listeners.size).toBe(0);
  });

  it("starts inactive in a hidden tab and works without IntersectionObserver", () => {
    const f = fakes(); f.doc.hidden = true;
    const changes: boolean[] = [];
    watchSceneVisibility({} as Element, (active) => changes.push(active), { document: f.doc });
    expect(changes).toEqual([false]);
    f.doc.hidden = false; f.listeners.forEach((listener) => listener());
    expect(changes).toEqual([false, true]);
  });
});
