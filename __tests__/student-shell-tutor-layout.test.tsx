// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/student/ai-tutor" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
import GlobalAssistantShell from "@/components/rag/GlobalAssistantShell";
import { getAssistantRoleConfig } from "@/lib/ai/rag/assistantAccess";
let root: Root;
let container: HTMLDivElement;
let pageHost: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear(); route.path = "/student/ai-tutor";
  HTMLElement.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div"); pageHost = document.createElement("div"); pageHost.id = "student-tutor-panel";
  document.body.append(pageHost, container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); pageHost.remove(); container.remove(); });
const render = async () => { await act(async () => root.render(<GlobalAssistantShell roleConfig={getAssistantRoleConfig("STUDENT")!} initialGrade={7} suggestedSubjects={["MATH"]} positionClassName="bottom-40 right-4" />)); };
describe("student Help respects its page instead of covering navigation", () => {
  it("does not turn visiting Help into an open floating panel on the next destination", async () => {
    localStorage.setItem("liberialearn-global-assistant-open", "false");
    await render();
    expect(localStorage.getItem("liberialearn-global-assistant-open")).toBe("false");
    route.path = "/student/textbooks"; await render();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("button[aria-expanded=false]")).not.toBeNull();
  });
  it("handles contextual lesson help once without turning it into a Help page overlay", async () => {
    route.path = "/student/lesson/fixture-place-value";
    await render();
    const detail = { handled: false };
    await act(async () => { window.dispatchEvent(new CustomEvent("liberialearn:open-tutor", { detail })); });
    expect(detail.handled).toBe(true);
    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    expect(container.querySelector("[data-assistant-presentation=floating]")).not.toBeNull();
    expect(pageHost.querySelector("textarea")).toBeNull();
    const input = container.querySelector("textarea")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input, "Keep this unfinished question"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await act(async () => { window.dispatchEvent(new CustomEvent("liberialearn:open-tutor", { detail })); });
    expect(container.querySelector("textarea")?.value).toBe("Keep this unfinished question");
  });
  it("leaves assigned lessons' own tutor panel as the only owner", async () => {
    route.path = "/student/lessons/fixture-work";
    await render();
    const detail = { handled: false };
    await act(async () => { window.dispatchEvent(new CustomEvent("liberialearn:open-tutor", { detail })); });
    expect(detail.handled).toBe(false);
    expect(container.querySelector("textarea")).toBeNull();
    expect(pageHost.querySelector("textarea")).toBeNull();
  });
  it("opens contextual help for assigned native lessons that replace legacy delivery", async () => {
    route.path = "/student/lessons/fixture-native-work";
    const marker = document.createElement("main"); marker.setAttribute("data-lesson-player-v2", ""); document.body.append(marker);
    try {
      await render();
      expect(container.querySelector("textarea")).toBeNull();
      const detail = { handled: false };
      await act(async () => { window.dispatchEvent(new CustomEvent("liberialearn:open-tutor", { detail })); });
      expect(detail.handled).toBe(true);
      expect(container.querySelectorAll("textarea")).toHaveLength(1);
      route.path = "/student/lessons/other-legacy-work"; await render();
      expect(container.querySelector("textarea")).toBeNull();
    } finally { marker.remove(); }
  });
  it("finds the page host when the authenticated page streams after layout hydration", async () => {
    pageHost.remove(); await render();
    expect(container.querySelector("[data-assistant-presentation=page]")).not.toBeNull();
    expect(container.querySelector(".fixed")).toBeNull();
    await act(async () => { document.body.append(pageHost); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(pageHost.querySelector("textarea")).not.toBeNull();
  });
  it("mounts the existing grounded assistant in the Help page host without fixed viewport positioning", async () => {
    await render();
    expect(pageHost.querySelector("textarea")).not.toBeNull();
    expect(pageHost.querySelector("[data-assistant-presentation=page]")).not.toBeNull();
    expect(pageHost.querySelector(".fixed")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });
  it("retains question input on a same-route rerender and can leave Help without a page overlay", async () => {
    await render();
    const input = pageHost.querySelector("textarea")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input, "Explain place value"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await render();
    expect(pageHost.querySelector("textarea")?.value).toBe("Explain place value");
    route.path = "/student/today"; await render();
    expect(pageHost.querySelector("textarea")).toBeNull();
    expect(container.querySelector("[data-assistant-presentation=page]")).toBeNull();
  });
});
