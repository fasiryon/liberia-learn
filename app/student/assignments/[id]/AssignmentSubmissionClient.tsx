"use client";

import { useMemo, useState } from "react";
import { enqueueOfflineRequest } from "@/lib/offline-queue";

type GradeData = {
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  turnedInAt: string | null;
};

type Props = {
  assignmentId: string;
  title: string;
  instructions: string | null;
  existingContent: string;
  gradeData?: GradeData | null;
};

export default function AssignmentSubmissionClient(props: Props) {
  const { gradeData } = props;
  const [content, setContent] = useState(props.existingContent);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content]
  );

  const isGraded = gradeData?.score !== null && gradeData?.score !== undefined;
  const isSubmitted = !!props.existingContent || !!gradeData?.turnedInAt;

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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to submit assignment.";
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (isGraded && gradeData) {
    return (
      <div className="space-y-5">
        {props.instructions ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm text-[var(--ll-text)]">
            {props.instructions}
          </section>
        ) : null}

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Graded
          </span>
          {gradeData.gradedAt ? (
            <span className="text-xs text-[var(--ll-text-muted)]">
              Graded on {new Date(gradeData.gradedAt).toLocaleDateString("en-LR", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Your Score</p>
          <p className="mt-2 text-5xl font-bold text-[var(--ll-text)]">
            {gradeData.score}
            <span className="ml-1 text-2xl font-normal text-[var(--ll-text-muted)]">/ 100</span>
          </p>
        </div>

        {gradeData.feedback ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Teacher Feedback</p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--ll-text)]">{gradeData.feedback}</p>
          </div>
        ) : null}

        {props.existingContent ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Your Submission</p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--ll-text)]">{props.existingContent}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (isSubmitted && !isGraded) {
    return (
      <div className="space-y-5">
        {props.instructions ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm text-[var(--ll-text)]">
            {props.instructions}
          </section>
        ) : null}

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
            Submitted — awaiting grade
          </span>
        </div>

        {props.existingContent ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Your Submission</p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--ll-text)]">{props.existingContent}</p>
          </div>
        ) : null}
      </div>
    );
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
