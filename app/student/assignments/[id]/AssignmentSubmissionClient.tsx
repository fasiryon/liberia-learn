"use client";

import { useMemo, useState } from "react";
import { enqueueOfflineRequest } from "@/lib/offline-queue";

type AssignmentSubmissionClientProps = {
  assignmentId: string;
  title: string;
  instructions: string | null;
  existingContent: string;
};

export default function AssignmentSubmissionClient(props: AssignmentSubmissionClientProps) {
  const [content, setContent] = useState(props.existingContent);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineRequest({
          type: "assignment-submission",
          endpoint: `/api/student/assignments/${props.assignmentId}/submit`,
          payload: { content },
          dedupeKey: `assignment-submission:${props.assignmentId}`,
        });
        setStatus("Saved offline. Will submit when you reconnect.");
        return;
      }

      const response = await fetch(`/api/student/assignments/${props.assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to submit assignment.");
      setStatus("Assignment submitted successfully.");
    } catch (error: any) {
      setStatus(error?.message ?? "Failed to submit assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {props.instructions ? (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm text-[var(--ll-text)]">
          {props.instructions}
        </section>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--ll-text)]">Your response</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-56 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-3 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
          placeholder="Write your assignment response here..."
          required
        />
      </label>

      <div className="flex items-center justify-between text-xs text-[var(--ll-text-muted)]">
        <span>Word count: {wordCount}</span>
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ll-yellow-soft)] px-5 text-sm font-semibold text-[var(--ll-text-faint)] disabled:cursor-not-allowed disabled:bg-[var(--ll-surface-muted)] disabled:text-[var(--ll-text-muted)]"
        >
          {submitting ? "Submitting..." : "Submit Assignment"}
        </button>
      </div>

      {status ? <p className="text-sm text-[var(--ll-text)]">{status}</p> : null}
    </form>
  );
}
