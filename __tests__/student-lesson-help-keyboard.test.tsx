// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StudentLessonHelpPanel } from "@/components/student/StudentLessonHelpPanel";

it("keeps keyboard focus in contextual lesson help and restores its trigger on Escape", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const trigger = document.createElement("button"), host = document.createElement("div");
  document.body.append(trigger, host); trigger.focus();
  const root = createRoot(host), close = vi.fn();
  const props = { onClose: close, lessonTitle: "Fixture lesson", subject: "MATH", grade: 7, question: "Unfinished question", onQuestionChange: vi.fn(), onQuestionSubmit: vi.fn(), messages: [], loading: false };
  try {
    await act(async () => root.render(<StudentLessonHelpPanel {...props} open />));
    const dialog = host.querySelector("[role=dialog]")!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    const controls = dialog.querySelectorAll<HTMLElement>("button:not(:disabled),textarea:not(:disabled)");
    controls[controls.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(controls[0]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(controls[controls.length - 1]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(close).toHaveBeenCalledOnce();
    await act(async () => root.render(<StudentLessonHelpPanel {...props} open={false} />));
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    await act(async () => root.render(<StudentLessonHelpPanel {...props} open />));
    expect(host.querySelector("textarea")?.value).toBe("Unfinished question");
  } finally { await act(async () => root.unmount()); trigger.remove(); host.remove(); }
});
