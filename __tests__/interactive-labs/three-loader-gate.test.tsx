// @vitest-environment jsdom
// RX-005 A2: hints like the target device (deviceMemory 2) keep the lab on LOW, and a spy proves the three.js
// renderer module is never loaded. A capable device (8 GB, WebGL2) upgrades and loads it exactly once.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const loads = vi.hoisted(() => ({ three: 0 }));
vi.mock("@/components/interactive-labs/v2/ThreeScene", async () => {
  loads.three += 1;
  const React = await import("react");
  return { ThreeScene: (props: { onReady?: () => void }) => { React.useEffect(() => { props.onReady?.(); }, []); return React.createElement("div", { "data-three-stub": true }); } };
});
// LOW stand-in: reports its first frame, then a passing frame probe (the real one needs 30 fast WebGL frames).
vi.mock("@/components/interactive-labs/v2/WebGLScene", async () => {
  const React = await import("react");
  return { WebGLScene: (props: { onReady?: () => void; onUpgradeReady?: () => void; allowProfileUpgrade?: boolean }) => {
    React.useEffect(() => { props.onReady?.(); if (props.allowProfileUpgrade) props.onUpgradeReady?.(); }, [props.allowProfileUpgrade]);
    return React.createElement("div", { "data-low-stub": true });
  } };
});
// The learner path renders only approved labs; use the circuit fixture as if approved.
vi.mock("@/lib/interactive-labs/v2/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/interactive-labs/v2/registry")>();
  return { ...actual, getInteractiveLabDefinition: (id: string) => { const definition = actual.getInteractiveLabDefinition(id); return definition && { ...definition, reviewState: "APPROVED", approvalState: "APPROVED" }; } };
});

const { InteractiveLabPlayer } = await import("@/components/interactive-labs/v2/InteractiveLabPlayer");

let host: HTMLDivElement, root: Root;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  Object.assign(window, { WebGLRenderingContext: function WebGLRenderingContext() {}, WebGL2RenderingContext: function WebGL2RenderingContext() {} });
});
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); });

async function openLab(deviceMemory: number) {
  Object.defineProperty(navigator, "deviceMemory", { value: deviceMemory, configurable: true });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  act(() => root.render(<InteractiveLabPlayer labId="fixture-simple-circuit" />));
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Start exploring")!.click());
  for (let tick = 0; tick < 10; tick += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  return host.querySelector("[data-lab-active-profile]")?.getAttribute("data-lab-active-profile");
}

describe("A2 three loader gate", () => {
  it("deviceMemory 2: stays on LOW and never loads the three.js renderer", async () => {
    expect(await openLab(2)).toBe("LOW");
    expect(host.querySelector("[data-low-stub]")).not.toBeNull();
    expect(loads.three).toBe(0);
  });

  it("deviceMemory 8 with WebGL2: the passing probe upgrades to HIGH and loads the renderer once", async () => {
    expect(await openLab(8)).toBe("HIGH");
    expect(host.querySelector("[data-three-stub]")).not.toBeNull();
    expect(loads.three).toBe(1);
  });
});
