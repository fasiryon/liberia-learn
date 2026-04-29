"use client";

import { useCallback, useEffect, useState } from "react";

type QueueStatus = {
  pending: number;
  processing: number;
  generated: number;
  failed: number;
  lastProcessed: string | null;
  estimatedCostUsd: number;
};

const GRADE_5_SUBJECTS = ["ENGLISH", "MATH", "SCIENCE", "SOCIAL_STUDIES"];

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value.toLocaleString("en-US")}</p>
    </div>
  );
}

export function TextbookGenerationClient({ initialStatus }: { initialStatus: QueueStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/admin/textbook-generation/status?grade=5&format=student");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function enqueueAll() {
    setBusy("enqueue");
    setMessage(null);
    try {
      const results = [];
      for (const subject of GRADE_5_SUBJECTS) {
        const res = await fetch("/api/admin/textbook-generation/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grade: 5, subject, format: "student" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Failed to enqueue ${subject}`);
        results.push({ subject, ...data });
      }
      setMessage(`Enqueue complete: ${JSON.stringify(results, null, 2)}`);
      await refreshStatus();
    } catch (error: any) {
      setMessage(error?.message ?? "Enqueue failed");
    } finally {
      setBusy(null);
    }
  }

  async function postAction(url: string, body: Record<string, unknown>, label: string, key: string) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `${label} failed`);
      setMessage(`${label} complete: ${JSON.stringify(data, null, 2)}`);
      await refreshStatus();
    } catch (error: any) {
      setMessage(error?.message ?? `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--ll-text-muted)]">Grade 5 student textbooks — Supabase lesson-pdf bucket</p>
        <button
          type="button"
          onClick={refreshStatus}
          className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] transition hover:border-teal-400 hover:text-teal-300"
        >
          Refresh
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending" value={status.pending} color="text-amber-300" />
        <StatCard label="Processing" value={status.processing} color="text-blue-300" />
        <StatCard label="Generated" value={status.generated} color="text-emerald-300" />
        <StatCard label="Failed" value={status.failed} color="text-red-300" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Last Processed</p>
          <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">
            {status.lastProcessed ? new Date(status.lastProcessed).toLocaleString("en-LR") : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Estimated Cost</p>
          <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">${status.estimatedCostUsd.toFixed(4)}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Actions</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={enqueueAll}
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "enqueue" ? "Enqueueing..." : "Enqueue Grade 5 All Subjects"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => postAction("/api/admin/textbook-generation/process", { limit: 12 }, "Process batch", "process")}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "process" ? "Processing..." : "Process Next Batch"}
          </button>
          <button
            type="button"
            disabled={busy !== null || status.failed === 0}
            onClick={() => postAction("/api/admin/textbook-generation/retry", { grade: 5, format: "student" }, "Retry failed", "retry")}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "retry" ? "Retrying..." : "Retry Failed"}
          </button>
        </div>
      </section>

      {message ? (
        <div className="whitespace-pre-wrap break-all rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 font-mono text-xs text-[var(--ll-text-muted)]">
          {message}
        </div>
      ) : null}
    </div>
  );
}
