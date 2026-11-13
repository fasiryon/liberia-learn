// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const lifecycle = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("@/components/learner-experience/LessonPlayerV2", () => ({ LessonPlayerV2: () => {
  const [value, setValue] = useState(0);
  useEffect(() => { lifecycle.mount(); return () => lifecycle.unmount(); }, []);
  return <button onClick={() => setValue(value + 1)}>Practice {value}</button>;
} }));
import { LearningPreviewPlayer } from "@/components/learner-experience/LearningPreviewPlayer";
import { LESSON_EXPERIENCES, HYDROPOWER_EXPERIENCE_ID } from "@/lib/learner-experience/fixtures/hydropowerLesson";

it("preserves memory while verifying, hidden or offline, and destroys it on definite revocation", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const selection = "factory@4.0.0-draft.6@g7-math-area-perimeter", packageHash = "a".repeat(64);
  const expiresAt = new Date(Date.now() + 60000).toISOString();
  const granted = { ok: true, status: 200, json: async () => ({ status: "PILOT_ONLY", identity: { selection, packageHash }, expiresAt }) };
  const fetcher = vi.fn().mockResolvedValue(granted); vi.stubGlobal("fetch", fetcher);
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<LearningPreviewPlayer selection={selection} packageHash={packageHash} expiresAt={expiresAt} experience={LESSON_EXPERIENCES[HYDROPOWER_EXPERIENCE_ID].experience} />));
    await act(async () => host.querySelector("button")?.click());
    expect(host.textContent).toContain("Practice 1");
    hidden.mockReturnValue(true);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(host.querySelector("[hidden]")).not.toBeNull();
    expect(host.querySelector("[role=alert]")).toBeNull();
    hidden.mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(host.textContent).toContain("Practice 1");
    online.mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(host.querySelector("[hidden]")).not.toBeNull();
    online.mockReturnValue(true); fetcher.mockRejectedValueOnce(new Error("temporary_network_failure"));
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(host.querySelector("[hidden]")).not.toBeNull();
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(host.textContent).toContain("Practice 1"); expect(lifecycle.mount).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue({ ok: false, status: 404 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(host.querySelector("button")).toBeNull(); expect(lifecycle.unmount).toHaveBeenCalledOnce();
    expect(host.querySelector("[role=alert]")?.textContent).toContain("no longer available");
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
