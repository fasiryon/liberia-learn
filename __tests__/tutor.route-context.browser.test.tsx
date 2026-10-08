// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ pathname: "/student/lesson/g7-addition" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
import GlobalAssistantShell from "@/components/rag/GlobalAssistantShell";
import { getAssistantRoleConfig } from "@/lib/ai/rag/assistantAccess";

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();
const render = async () => {
  await act(async () => { root.render(<GlobalAssistantShell roleConfig={getAssistantRoleConfig("STUDENT")!} initialGrade={7} suggestedSubjects={["MATH"]} initialOpen />); });
};
const ask = async (text = "Explain this topic") => {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === text);
  expect(button).toBeDefined();
  await act(async () => { button!.click(); });
  const submit = [...container.querySelectorAll("button")].find((item) => item.textContent === "Ask Assistant")!;
  await act(async () => { submit.click(); });
  expect(fetchMock).toHaveBeenCalled();
  return JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
};
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear();
  navigation.pathname = "/student/lesson/g7-addition";
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ answer: "Current addition explanation", sources: [], retrievalWeak: false, hadFallback: false, isWeakGrounding: false, actions: [] }) });
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("catalog lesson tutor browser requests", () => {
  it("sends content identity on direct navigation and after reload without page markers", async () => {
    await render();
    expect((await ask()).tutorContext).toEqual({ contentId: "g7-addition" });
    await act(async () => root.unmount()); root = createRoot(container);
    await render();
    expect((await ask()).tutorContext).toEqual({ contentId: "g7-addition" });
  });
  it("sends catalog identity on link entry and replaces it across route transitions", async () => {
    navigation.pathname = "/student/lessons";
    await render();
    navigation.pathname = "/student/lesson/g7-addition"; // Catalog Link navigation.
    await render();
    expect((await ask()).tutorContext).toEqual({ contentId: "g7-addition" });
    expect(container.textContent).toContain("Current addition explanation");
    // A delayed page context from the previous route cannot pin the next lesson.
    navigation.pathname = "/student/lesson/g7-subtraction";
    await render();
    await act(async () => window.dispatchEvent(new CustomEvent("liberialearn:tutor-context", { detail: { pathname: "/student/lesson/g7-addition", identity: { contentId: "g7-addition", sceneId: "old-scene" } } })));
    expect(container.textContent).not.toContain("Current addition explanation");
    expect((await ask()).tutorContext).toEqual({ contentId: "g7-subtraction" });
    navigation.pathname = "/student/lessons/scheduled-a";
    await render();
    expect(container.textContent).toBe(""); // Scheduled delivery owns its existing lesson helper.
    navigation.pathname = "/student/lesson/g7-addition";
    await render();
    expect((await ask()).tutorContext).toEqual({ contentId: "g7-addition" });
  });
});
