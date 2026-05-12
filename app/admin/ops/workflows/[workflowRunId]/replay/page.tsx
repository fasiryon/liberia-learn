"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ReplayMode = "analysis_only" | "recommendation_only" | "approved_action_replay";

const MODE_LABELS: Record<ReplayMode, string> = {
  analysis_only: "Analysis only (no side effects)",
  recommendation_only: "Recommendation only",
  approved_action_replay: "Approved action replay (LIVE)",
};

const MODE_RISK: Record<ReplayMode, "low" | "medium" | "high"> = {
  analysis_only: "low",
  recommendation_only: "medium",
  approved_action_replay: "high",
};

interface DryRunResult {
  dryRun: true;
  workflowRunId: string;
  workflowType: string;
  status: string;
  replayMode: ReplayMode;
  replaySafe: boolean;
  sideEffectsBlockedByDefault: boolean;
  checkpointCount: number;
  stepCount: number;
  decisionCount: number;
  actionCount: number;
}

interface LiveReplayResult {
  dryRun: false;
  replayed: true;
  newWorkflowRunId: string;
  replayMode: ReplayMode;
  originalWorkflowRunId: string;
}

export default function ReplayConsolePage() {
  const params = useParams<{ workflowRunId: string }>();
  const workflowRunId = params.workflowRunId;

  const [replayMode, setReplayMode] = useState<ReplayMode>("analysis_only");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [liveResult, setLiveResult] = useState<LiveReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function runDryRun() {
    setLoading(true);
    setError(null);
    setDryRunResult(null);
    setLiveResult(null);
    setShowConfirm(false);
    try {
      const res = await fetch(`/api/admin/ops/workflows/${workflowRunId}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, replayMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setDryRunResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function executeLiveReplay() {
    setLoading(true);
    setError(null);
    setShowConfirm(false);
    try {
      const res = await fetch(`/api/admin/ops/workflows/${workflowRunId}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, confirm: true, replayMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setLiveResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  const riskLevel = MODE_RISK[replayMode];

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link className="text-sm underline" href={`/admin/ops/workflows/${workflowRunId}`}>
            ← Back to workflow detail
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Replay Console</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Replay a workflow run for investigation or re-execution under controlled conditions.
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--ll-text-faint)]">{workflowRunId}</p>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-4">
          <h2 className="text-lg font-semibold">Replay Mode</h2>
          <div className="space-y-2">
            {(Object.keys(MODE_LABELS) as ReplayMode[]).map((mode) => (
              <label key={mode} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="replayMode"
                  value={mode}
                  checked={replayMode === mode}
                  onChange={() => {
                    setReplayMode(mode);
                    setDryRunResult(null);
                    setLiveResult(null);
                    setError(null);
                    setShowConfirm(false);
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium">{MODE_LABELS[mode]}</p>
                  <p className={`text-xs ${mode === "approved_action_replay" ? "text-red-400" : "text-[var(--ll-text-muted)]"}`}>
                    risk: {MODE_RISK[mode]}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {riskLevel === "high" && (
            <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <strong>WARNING:</strong> Approved action replay executes real side effects. Only proceed if
              the original failure was transient and the workflow is replay-safe. Confirm the dry-run
              assessment below before proceeding.
            </div>
          )}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Step 1: Dry-Run Safety Assessment</h2>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Run a dry-run to see what would be replayed without making any changes.
          </p>
          <button
            onClick={runDryRun}
            disabled={loading}
            className="rounded bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Assessing…" : "Run Dry-Run Assessment"}
          </button>

          {dryRunResult && (
            <div className="rounded border border-[var(--ll-border)] bg-black/20 p-3 text-sm space-y-1">
              <p>
                Workflow: <strong>{dryRunResult.workflowType}</strong> — status:{" "}
                <span className="font-mono">{dryRunResult.status}</span>
              </p>
              <p>
                Replay safe:{" "}
                <span className={dryRunResult.replaySafe ? "text-green-400" : "text-red-400"}>
                  {dryRunResult.replaySafe ? "YES" : "NO — has succeeded actions"}
                </span>
              </p>
              <p className="text-[var(--ll-text-muted)]">
                Checkpoints: {dryRunResult.checkpointCount} · Steps: {dryRunResult.stepCount} ·
                Decisions: {dryRunResult.decisionCount} · Actions: {dryRunResult.actionCount}
              </p>
              <p className="text-[var(--ll-text-muted)]">
                Side effects blocked by default:{" "}
                {dryRunResult.sideEffectsBlockedByDefault ? "yes" : "no"}
              </p>
            </div>
          )}
        </section>

        {dryRunResult && !liveResult && (
          <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-3">
            <h2 className="text-lg font-semibold">Step 2: Execute Replay</h2>
            {!dryRunResult.replaySafe && replayMode !== "analysis_only" ? (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                Replay blocked — workflow has succeeded actions and replayMode is not analysis_only.
                Switch to <strong>analysis_only</strong> or investigate the original run first.
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--ll-text-muted)]">
                  Mode: <strong>{MODE_LABELS[replayMode]}</strong>
                </p>
                {!showConfirm ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={loading}
                    className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                      riskLevel === "high"
                        ? "bg-red-600 text-white"
                        : "bg-[var(--ll-yellow)] text-black"
                    }`}
                  >
                    {riskLevel === "high" ? "⚠ Initiate Live Replay…" : "Execute Replay…"}
                  </button>
                ) : (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 space-y-3">
                    <p className="text-sm font-semibold text-amber-300">
                      Confirm: Execute live replay of {workflowRunId.slice(0, 16)}… in{" "}
                      <strong>{replayMode}</strong> mode?
                    </p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      This will create a new WorkflowRun and write to AuditLog. This action
                      cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={executeLiveReplay}
                        disabled={loading}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {loading ? "Executing…" : "Confirm — Execute Now"}
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        className="rounded border border-[var(--ll-border)] px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {liveResult && (
          <section className="rounded border border-green-500/40 bg-green-500/10 p-4 space-y-2">
            <h2 className="text-lg font-semibold text-green-400">Replay Initiated</h2>
            <p className="text-sm">
              New workflow run created:{" "}
              <Link
                className="font-mono text-xs underline"
                href={`/admin/ops/workflows/${liveResult.newWorkflowRunId}`}
              >
                {liveResult.newWorkflowRunId}
              </Link>
            </p>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Mode: {liveResult.replayMode} · Original: {liveResult.originalWorkflowRunId.slice(0, 16)}…
            </p>
          </section>
        )}

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
