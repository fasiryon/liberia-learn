"use client";

import { useState } from "react";
import type { PlannedLabAction } from "@/lib/labs/types";

type LabChatPanelProps = {
  labId: string;
  lessonId?: string | null;
  state: unknown;
  suggestedPrompts: string[];
  onAction: (planned: PlannedLabAction) => Promise<unknown> | unknown;
};

export default function LabChatPanel({
  labId,
  lessonId,
  state,
  suggestedPrompts,
  onAction,
}: LabChatPanelProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);

  async function submit(nextMessage = message) {
    const trimmed = nextMessage.trim();
    if (trimmed.length < 2 || status === "loading") return;

    setStatus("loading");
    setAssistantMessage(null);

    try {
      const planResponse = await fetch(`/api/labs/${labId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, state, lessonId }),
      });

      if (!planResponse.ok) {
        throw new Error("plan_failed");
      }

      const planJson = (await planResponse.json()) as {
        ok: boolean;
        planned: PlannedLabAction;
      };

      if (!planJson.ok || planJson.planned.rejected) {
        setAssistantMessage(planJson.planned.userFacingMessage);
        setStatus("idle");
        return;
      }

      const before = state;
      const after = await onAction(planJson.planned);
      const explainResponse = await fetch(`/api/labs/${labId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousState: before,
          nextState: after ?? before,
          actionType: planJson.planned.actionType ?? planJson.planned.action?.type ?? null,
          lessonId,
        }),
      });

      if (!explainResponse.ok) {
        throw new Error("explain_failed");
      }

      const explainJson = (await explainResponse.json()) as { explanation?: string };
      setAssistantMessage(explainJson.explanation ?? planJson.planned.userFacingMessage);
      setMessage("");
      setStatus("idle");
    } catch {
      setAssistantMessage("The lab tutor could not respond. Try again in a moment.");
      setStatus("error");
    }
  }

  return (
    <section className="border-t border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-4 text-sm sm:px-5">
      <div className="flex flex-wrap gap-2">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submit(prompt)}
            disabled={status === "loading"}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-left text-xs text-[var(--ll-text-muted)] transition-colors hover:border-[var(--ll-border-strong)] hover:text-[var(--ll-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {assistantMessage ? (
        <div
          className={`mt-4 ll-notice ${status === "error" ? "ll-notice-error" : "ll-notice-success"}`}
          aria-live="polite"
        >
          {assistantMessage}
        </div>
      ) : null}

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={`lab-chat-${labId}`}>
          Ask the lab tutor
        </label>
        <textarea
          id={`lab-chat-${labId}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask the lab to change something"
          className="min-h-24 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ll-text)] outline-none transition-colors focus:border-[var(--ll-border-strong)] focus:shadow-[var(--ll-focus)]"
        />
        <button
          type="submit"
          disabled={status === "loading" || message.trim().length < 2}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--ll-surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-muted)] transition-colors hover:bg-[var(--ll-surface)] hover:text-[var(--ll-text)] disabled:cursor-not-allowed disabled:text-[var(--ll-text-faint)]"
        >
          {status === "loading" ? "Planning..." : "Ask Lab Tutor"}
        </button>
      </form>
    </section>
  );
}
