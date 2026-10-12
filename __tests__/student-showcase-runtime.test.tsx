// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";

let root: Root | undefined;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; vi.unstubAllGlobals(); });

describe("existing observation-only showcase player", () => {
  it.each(["g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower"])("opens and accepts local interactions for %s without persistence", async (labId) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const host = document.createElement("div");
    root = createRoot(host);
    await act(async () => { root!.render(<InteractiveLabPlayer labId={labId} internalPreview override="FALLBACK_2D" />); });
    expect(host.textContent).not.toContain("This lab is not available.");
    const start = [...host.querySelectorAll("button")].find((button) => button.textContent === "Start exploring");
    expect(start).toBeDefined();
    await act(async () => { start!.click(); });
    expect(host.querySelector('[data-lab-active-profile="FALLBACK_2D"]')).not.toBeNull();
    const assessment = [...host.querySelectorAll("button")].find((button) => button.textContent === "Assessment");
    expect(assessment).toBeDefined();
    await act(async () => { assessment!.click(); });
    const check = [...host.querySelectorAll("button")].find((button) => button.textContent === "Check my work");
    if (labId === "fixture-lever") {
      // This existing fixture's transition is a no-op; showcase authorization does not rewrite it.
      expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Guided")?.getAttribute("aria-pressed")).toBe("true");
      expect(check).toBeUndefined();
    } else {
      expect(check).toBeDefined();
      await act(async () => { check!.click(); });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
