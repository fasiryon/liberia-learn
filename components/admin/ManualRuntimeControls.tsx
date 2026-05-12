"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ManualRunSummary = {
  kind: string;
  status: string;
  skipped: boolean;
  reason: string | null;
  processed: number;
  failed: number;
  durationMs: number;
  reused?: boolean;
  ranAt?: string;
  result?: Record<string, unknown>;
};

type HistoryRow = {
  pipeline: string;
  kind: string;
  ranAt: string;
  status: string;
  skipped: boolean;
  reason: string | null;
  processed: number;
  failed: number;
  durationMs: number;
};

const CONTROLS = [
  {
    label: "Run stale approval expiration now",
    endpoint: "/api/admin/ops/runtime/run/stale-approvals",
    confirm: "Run stale approval expiration now?",
  },
  {
    label: "Run evaluation window scan now",
    endpoint: "/api/admin/ops/runtime/run/evaluation-windows",
    confirm: "Run evaluation window scan now?",
  },
  {
    label: "Run workflow recovery now",
    endpoint: "/api/admin/ops/runtime/run/workflow-recovery",
    confirm: "Run workflow recovery now?",
  },
  {
    label: "Run runtime health check now",
    endpoint: "/api/admin/ops/runtime/run/runtime-health",
    confirm: "Run runtime health check now?",
  },
  {
    label: "Run dead-letter inspection now",
    endpoint: "/api/admin/ops/runtime/run/dead-letter-inspection",
    confirm: "Run dead-letter inspection now?",
  },
  {
    label: "Run full runtime maintenance now",
    endpoint: "/api/admin/ops/runtime/run/full-maintenance",
    confirm: "Run full runtime maintenance now? This executes each enabled maintenance job once.",
  },
];

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return value.slice(0, 16).replace("T", " ");
}

export default function ManualRuntimeControls({
  history,
  cronPaused,
}: {
  history: HistoryRow[];
  cronPaused: boolean;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ManualRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastManualRun = useMemo(() => history[0] ?? null, [history]);

  async function runControl(endpoint: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setRunning(endpoint);
    setError(null);
    setLastResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `${endpoint}:${Date.now()}:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Manual runtime run failed");
      setLastResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Manual runtime run failed");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Manual Runtime Controls</h2>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Platform-admin maintenance runs use authenticated admin APIs and do not require CRON_SECRET.
          </p>
        </div>
        <div className="text-sm text-[var(--ll-text-muted)]">
          Last manual run: <span className="font-mono">{formatDate(lastManualRun?.ranAt)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/admin/ops/runtime/runs">View full run history</Link>
        <Link className="underline" href="/admin/ops/runtime/smoke">Open smoke verification</Link>
      </div>

      {cronPaused && (
        <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Vercel cron is paused for this deployment. Manual controls keep runtime maintenance available without restoring cron entries.
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {CONTROLS.map((control) => (
          <button
            key={control.endpoint}
            type="button"
            disabled={running !== null}
            onClick={() => runControl(control.endpoint, control.confirm)}
            className="rounded border border-[var(--ll-border)] px-3 py-2 text-left text-sm font-medium hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running === control.endpoint ? "Running..." : control.label}
          </button>
        ))}
      </div>

      {lastResult && (
        <div className="mt-4 rounded border border-[var(--ll-border)] p-3 text-sm">
          <p className="font-semibold">
            {lastResult.kind} {lastResult.status}
            {lastResult.skipped ? ` (${lastResult.reason ?? "skipped"})` : ""}
            {lastResult.reused ? " (reused)" : ""}
          </p>
          <p className="mt-1 text-[var(--ll-text-muted)]">
            Processed {lastResult.processed} - failed {lastResult.failed} - {lastResult.durationMs}ms
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 divide-y divide-[var(--ll-border)] text-sm">
          {history.slice(0, 5).map((run, index) => (
            <div key={`${run.pipeline}-${run.ranAt}-${index}`} className="grid gap-1 py-2 md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-medium">{run.kind}</p>
                <p className="font-mono text-xs text-[var(--ll-text-muted)]">{run.pipeline}</p>
              </div>
              <div className="text-right text-xs text-[var(--ll-text-muted)]">
                <p>{formatDate(run.ranAt)} - {run.status}{run.skipped ? ` - ${run.reason ?? "skipped"}` : ""}</p>
                <p>processed {run.processed} - failed {run.failed} - {run.durationMs}ms</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
