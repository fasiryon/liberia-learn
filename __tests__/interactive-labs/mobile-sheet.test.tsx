// @vitest-environment jsdom
// RX-005e / A17: the phone-portrait bottom sheet (peek, half, full) and its peek content.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
import { dragSnap, nextSnap } from "@/components/interactive-labs/v2/MobileSheet";

let matches = false;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

describe("mobile bottom sheet", () => {
  it("cycles peek → half → full → peek and snaps one step per drag", () => {
    expect([nextSnap("peek"), nextSnap("half"), nextSnap("full")]).toEqual(["half", "full", "peek"]);
    expect([dragSnap("peek", -40), dragSnap("half", -40), dragSnap("full", -40)]).toEqual(["half", "full", "full"]);
    expect([dragSnap("full", 40), dragSnap("half", 40), dragSnap("peek", 40)]).toEqual(["half", "peek", "peek"]);
    expect(dragSnap("half", 10)).toBe("half");
  });

  let host: HTMLDivElement, root: Root;
  afterEach(() => { if (!host) return; act(() => root.unmount()); host.remove(); host = undefined as unknown as HTMLDivElement; });
  const mount = () => {
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    act(() => root.render(<InteractiveLabPlayer labId={hydropowerDefinition.id} override="FALLBACK_2D" reviewPreview={{ initialState: initializeLab(hydropowerDefinition) }} />));
  };

  it("on a phone in portrait, the peek states the task, the HUD quantities and the latest causal line; the body is hidden", () => {
    matches = false; mount();
    const sheet = host.querySelector<HTMLElement>("[data-lab-sheet]")!;
    expect(sheet.dataset.labSheet).toBe("peek");
    const peek = sheet.querySelector("[data-lab-sheet-peek]")!.textContent!;
    expect(peek).toContain(hydropowerDefinition.fidelity!.guidedPath[0].prompt);
    expect(peek).toContain("Available capacity");
    expect(peek).toContain("Delivered to city");
    expect(sheet.querySelector<HTMLElement>("#lab-sheet-body")!.hidden).toBe(true);
    const handle = sheet.querySelector<HTMLButtonElement>("button[aria-controls=lab-sheet-body]")!;
    expect(handle.getAttribute("aria-label")).toMatch(/^Lab controls and next step/);
    act(() => handle.click());
    expect([sheet.dataset.labSheet, sheet.style.height, sheet.querySelector<HTMLElement>("#lab-sheet-body")!.hidden]).toEqual(["half", "50dvh", false]);
    act(() => handle.click());
    expect([sheet.dataset.labSheet, sheet.style.height]).toEqual(["full", "88dvh"]);
  });

  it("on desktop or a phone in landscape, the controls stay a side column (no sheet)", () => {
    matches = true; mount();
    expect(host.querySelector("[data-lab-sheet]")).toBeNull();
    expect(host.querySelector("aside#lab-controls")).not.toBeNull();
  });
});
