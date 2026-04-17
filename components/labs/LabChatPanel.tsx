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
    <section className="border-t border-slate-800 bg-slate-950 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap gap-2">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submit(prompt)}
            disabled={status === "loading"}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {assistantMessage ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm leading-6 ${
            status === "error"
              ? "border border-amber-400/30 bg-amber-950/40 text-amber-100"
              : "bg-slate-900 text-slate-100"
          }`}
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
          className="min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-base leading-6 text-slate-50 outline-none transition-colors focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/70"
        />
        <button
          type="submit"
          disabled={status === "loading" || message.trim().length < 2}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {status === "loading" ? "Planning..." : "Ask Lab Tutor"}
        </button>
      </form>
    </section>
  );
}
