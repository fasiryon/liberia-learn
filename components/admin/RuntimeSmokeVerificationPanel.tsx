"use client";

import { useState } from "react";

type SmokeCheck = {
  key: string;
  label: string;
  status: "PASS" | "WARN" | "FAIL" | "SKIPPED";
  summary: string;
};

type SmokeResult = {
  overallStatus: "PASS" | "WARN" | "FAIL" | "SKIPPED";
  timestamp: string;
  actor: { id: string; role: string; isPlatformAdmin: boolean };
  checks: SmokeCheck[];
  warnings: string[];
  recommendedNextActions: string[];
};

const BADGE: Record<string, string> = {
  PASS: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
  WARN: "border-amber-500/50 bg-amber-500/10 text-amber-100",
  FAIL: "border-red-500/50 bg-red-500/10 text-red-100",
  SKIPPED: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
};

export default function RuntimeSmokeVerificationPanel() {
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSmoke() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ops/runtime/smoke", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data?.checks) throw new Error(data?.error ?? "Smoke verification failed");
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Smoke verification failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Smoke Verification</h2>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Runs platform-admin-only readiness checks without executing runtime maintenance jobs.
          </p>
        </div>
        <button
          type="button"
          onClick={runSmoke}
          disabled={running}
          className="rounded border border-[var(--ll-border)] px-3 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-60"
        >
          {running ? "Running..." : "Run smoke verification"}
        </button>
      </div>

      {error && <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      {result && (
        <div className="mt-4 space-y-4">
          <div className={`rounded border p-4 ${BADGE[result.overallStatus]}`}>
            <div className="text-sm font-semibold uppercase tracking-wide">Overall status</div>
            <div className="mt-1 text-2xl font-semibold">{result.overallStatus}</div>
            <p className="mt-1 text-xs">
              {result.timestamp} - {result.actor.role} - {result.actor.id}
            </p>
          </div>

          <div className="divide-y divide-[var(--ll-border)] text-sm">
            {result.checks.map((check) => (
              <div key={check.key} className="grid gap-2 py-3 md:grid-cols-[140px_1fr]">
                <span className={`w-fit rounded border px-2 py-0.5 text-xs font-semibold ${BADGE[check.status]}`}>{check.status}</span>
                <div>
                  <p className="font-medium">{check.label}</p>
                  <p className="text-[var(--ll-text-muted)]">{check.summary}</p>
                </div>
              </div>
            ))}
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              <h3 className="font-semibold">Warnings</h3>
              <ul className="mt-2 list-disc pl-5">
                {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded border border-[var(--ll-border)] p-3 text-sm">
            <h3 className="font-semibold">Recommended next actions</h3>
            <ul className="mt-2 list-disc pl-5 text-[var(--ll-text-muted)]">
              {result.recommendedNextActions.map((action) => <li key={action}>{action}</li>)}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
