"use client";

import { useCallback, useEffect, useState } from "react";

type QueueStatus = {
  pending: number;
  processing: number;
  generated: number;
  failed: number;
  lastProcessed: string | null;
  totalCostUsd: number;
  autoModeEnabled?: boolean;
  cron?: {
    lastRunAt: string | null;
    jobsProcessedToday: number;
    lastRunProcessed: number;
    lastRunFailed: number;
  };
};

type ActionMessage = { kind: "success" | "error"; text: string } | null;

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value.toLocaleString("en-US")}</p>
    </div>
  );
}

export function AudioGenerationClient({
  initialStatus,
}: {
  initialStatus: QueueStatus;
}) {
  const [status, setStatus] = useState<QueueStatus>(initialStatus);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/audio-generation/status?grade=5&subject=ENGLISH");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function runAction(
    url: string,
    body: Record<string, unknown>,
    label: string,
    setter: (v: boolean) => void
  ) {
    setter(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `${label} failed`);
      const detail = JSON.stringify(data, null, 2);
      setMessage({ kind: "success", text: `${label} complete: ${detail}` });
      await refreshStatus();
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? `${label} failed` });
    } finally {
      setter(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--ll-text-muted)]">
          Grade 5 English — Supabase lesson-audio bucket
        </p>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={loadingStatus}
          className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] transition hover:border-teal-400 hover:text-teal-300 disabled:opacity-50"
        >
          {loadingStatus ? "Refreshing…" : "Refresh"}
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
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Auto Mode</p>
          <p className={`mt-2 text-sm font-semibold ${status.autoModeEnabled ? "text-emerald-300" : "text-amber-300"}`}>
            {status.autoModeEnabled ? "ON" : "OFF"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Last Processed</p>
          <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">
            {status.lastProcessed
              ? new Date(status.lastProcessed).toLocaleString("en-LR")
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Last Cron Run</p>
          <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">
            {status.cron?.lastRunAt
              ? new Date(status.cron.lastRunAt).toLocaleString("en-LR")
              : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Jobs Processed Today</p>
          <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">
            {(status.cron?.jobsProcessedToday ?? 0).toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Estimated Cost (Generated)</p>
          <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">
            ${status.totalCostUsd.toFixed(4)}
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Actions — Grade 5 English</p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={enqueueing}
            onClick={() =>
              runAction(
                "/api/admin/audio-generation/enqueue",
                { grade: 5, subject: "ENGLISH", limit: 50 },
                "Enqueue",
                setEnqueueing
              )
            }
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enqueueing ? "Enqueueing…" : "Enqueue Grade 5 English"}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() =>
              runAction(
                "/api/admin/audio-generation/process",
                { limit: 3 },
                "Process batch",
                setProcessing
              )
            }
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? "Processing…" : "Process Next Batch (3)"}
          </button>

          <button
            type="button"
            disabled={retrying || status.failed === 0}
            onClick={() =>
              runAction(
                "/api/admin/audio-generation/retry",
                { grade: 5, subject: "ENGLISH" },
                "Retry failed",
                setRetrying
              )
            }
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrying ? "Retrying…" : `Retry Failed (${status.failed})`}
          </button>
        </div>
      </section>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-mono whitespace-pre-wrap break-all ${
            message.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Cron Integration</p>
        <div className="mt-3 space-y-1 text-xs text-[var(--ll-text-muted)]">
          <p>
            Endpoint: <code className="rounded bg-[var(--ll-surface)] px-1.5 py-0.5 text-[var(--ll-text)]">POST /api/cron/process-audio-generation</code>
          </p>
          <p>
            Auth: <code className="rounded bg-[var(--ll-surface)] px-1.5 py-0.5 text-[var(--ll-text)]">Authorization: Bearer $CRON_SECRET</code>
          </p>
          <p>Default batch: 5 jobs per invocation. Set <code className="rounded bg-[var(--ll-surface)] px-1.5 py-0.5 text-[var(--ll-text)]">CRON_SECRET</code> in Vercel environment variables.</p>
        </div>
      </section>
    </div>
  );
}
