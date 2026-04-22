"use client";

import { useState } from "react";

export default function DemoModePage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleAction(action: string, label: string) {
    setLoading(action);
    setResult(null);
    try {
      const res = await fetch(`/api/platform/demo/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(`${label}: ${JSON.stringify(data)}`);
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3">
        <p className="text-sm text-red-300 font-semibold">
          This page is for demonstration purposes only. Do not use in production.
        </p>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Demo Mode</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">Tools for managing demo data during MOE presentation</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-2">Reset Demo Data</h2>
          <p className="text-xs text-[var(--ll-text-muted)] mb-3">Re-seed all 3 demo schools to clean state.</p>
          <button
            onClick={() => handleAction("reset", "Reset")}
            disabled={loading !== null}
            className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-[var(--ll-text)] hover:bg-red-400 disabled:opacity-50"
          >
            {loading === "reset" ? "Resetting..." : "Reset Demo Data"}
          </button>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-2">Advance Demo Day</h2>
          <p className="text-xs text-[var(--ll-text-muted)] mb-3">Move all scheduled work dates forward by 1 day.</p>
          <button
            onClick={() => handleAction("advance-day", "Advance")}
            disabled={loading !== null}
            className="rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
          >
            {loading === "advance-day" ? "Advancing..." : "Advance Demo Day"}
          </button>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-2">Simulate Student Activity</h2>
          <p className="text-xs text-[var(--ll-text-muted)] mb-3">Mark 60% of today&apos;s Monrovia Central work as complete.</p>
          <button
            onClick={() => handleAction("simulate-activity", "Simulate")}
            disabled={loading !== null}
            className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
          >
            {loading === "simulate-activity" ? "Simulating..." : "Simulate Student Activity"}
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 p-4">
          <p className="text-xs text-[var(--ll-text)] font-mono">{result}</p>
        </div>
      )}
    </div>
  );
}
