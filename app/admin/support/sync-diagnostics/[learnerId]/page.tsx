"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { LearnerSyncDiagnosticsView } from "@/lib/support/learnerSyncDiagnostics";
import type { SyncDiagnosticState } from "@/lib/offline/syncDiagnosticsContract";

const STATE_GUIDANCE: Record<SyncDiagnosticState, { label: string; tone: string; guidance: string }> = {
  OFFLINE: { label: "Offline", tone: "border-amber-500/40 bg-amber-500/10", guidance: "The device has not reached the server recently while work is waiting. Ask the learner to connect and open LiberiaLearn." },
  AUTH_EXPIRED: { label: "Sign-in expired", tone: "border-amber-500/40 bg-amber-500/10", guidance: "Saved work is held until the learner signs in again on the same device." },
  WAITING_FOR_ORIGINAL_LEARNER: { label: "Waiting for original learner", tone: "border-amber-500/40 bg-amber-500/10", guidance: "Work was recorded under a different learner identity. It only syncs when the learner who recorded it signs in on that device." },
  STALE_RELEASE: { label: "Stale release", tone: "border-amber-500/40 bg-amber-500/10", guidance: "Queued work references a lesson release the server no longer accepts as current. The evidence is preserved; the learner should update the app and review the flagged items." },
  QUARANTINED: { label: "Quarantined", tone: "border-red-500/40 bg-red-500/10", guidance: "Some operations stopped retrying after repeated or terminal failures. They remain on the device; the learner can use Try again from the sync banner." },
  SERVER_CONFLICT: { label: "Server conflict", tone: "border-red-500/40 bg-red-500/10", guidance: "The server holds a different version. The learner reviews these on the Offline status page." },
  RETRY_PENDING: { label: "Retry pending", tone: "border-sky-500/40 bg-sky-500/10", guidance: "Work is queued and will be sent on the next retry or reconnect." },
  SERVER_RECEIVED: { label: "Server received", tone: "border-sky-500/40 bg-sky-500/10", guidance: "The server has recorded a verdict for this work. The device clears it after its next sync." },
  SYNCED: { label: "Synced", tone: "border-emerald-500/40 bg-emerald-500/10", guidance: "The latest device report shows no unconfirmed work." },
  UNKNOWN: { label: "Unknown", tone: "border-[var(--ll-border)] bg-[var(--ll-surface)]", guidance: "No device report or server sync evidence in the diagnostic window. Unknown is not the same as synced." },
};

const NOT_REPORTED = "Not reported";

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : NOT_REPORTED;
}

function duration(seconds: number | null) {
  if (seconds === null) return NOT_REPORTED;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function show(value: number | string | boolean | null | undefined) {
  if (value === null || value === undefined) return NOT_REPORTED;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${value === NOT_REPORTED ? "text-[var(--ll-text-muted)]" : ""}`}>{value}</p>
    </div>
  );
}

export default function LearnerSyncDiagnosticsPage() {
  const params = useParams<{ learnerId: string }>();
  const learnerId = params?.learnerId ?? "";
  const [data, setData] = useState<LearnerSyncDiagnosticsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/support/learners/${encodeURIComponent(learnerId)}/sync-diagnostics`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
        if (!cancelled) setData(body.diagnostics);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [learnerId]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">Learner sync diagnostics (read-only)</p>
            <h1 className="text-3xl font-bold">{data?.learner.displayName ?? "Learner"}</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Diagnostic bookkeeping only. No answers, lesson content, or learner work is shown, and nothing here changes the learner&apos;s queue or records. This view is audited.
            </p>
          </div>
          <Link href="/admin/support/sync-diagnostics" className="inline-flex rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)]">
            Look up another learner
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>
        )}
        {!data && !error && <div className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />}

        {data && (
          <>
            <section className={`rounded-xl border p-6 ${STATE_GUIDANCE[data.primaryState].tone}`}>
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Primary state</p>
              <h2 className="mt-1 text-2xl font-bold">{STATE_GUIDANCE[data.primaryState].label} <span className="text-sm font-mono text-[var(--ll-text-muted)]">{data.primaryState}</span></h2>
              <p className="mt-2 text-sm">{STATE_GUIDANCE[data.primaryState].guidance}</p>
              {data.activeStates.length > 1 && (
                <ul className="mt-4 space-y-1 text-sm">
                  {data.activeStates.slice(1).map((state) => (
                    <li key={state}><span className="font-mono">{state}</span>: {STATE_GUIDANCE[state].guidance}</li>
                  ))}
                </ul>
              )}
              {data.device.stale && (
                <p className="mt-3 text-sm font-semibold">The latest device report is more than 6 hours old; device figures describe that time, not now.</p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Last successful sync" value={when(data.lastSuccessfulSyncAt)} />
              <Fact label="Last server contact" value={when(data.lastServerContactAt)} />
              <Fact label="Device report received" value={when(data.device.reportedAt)} />
              <Fact label="Device online at report" value={show(data.device.online)} />
              <Fact label="Client version" value={show(data.device.clientVersion)} />
              <Fact label="Sync protocol" value={show(data.device.protocolVersion)} />
              <Fact label="App release (device)" value={show(data.release.appRelease?.slice(0, 12))} />
              <Fact label="App release matches server" value={show(data.release.appReleaseMatchesServer)} />
              <Fact
                label="Queued content release"
                value={data.release.queuedReleaseSequence ? `rev ${data.release.queuedReleaseSequence.revision}.${data.release.queuedReleaseSequence.governance}` : NOT_REPORTED}
              />
              <Fact label="Oldest pending age" value={duration(data.queue.oldestPendingAgeSeconds)} />
              <Fact label="Max retry count" value={show(data.queue.maxRetryCount)} />
              <Fact label="Next retry in" value={duration(data.queue.nextRetryInSeconds)} />
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
              <h2 className="text-lg font-semibold">Device queue</h2>
              {data.queue.counts ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Fact label="Unconfirmed" value={String(data.queue.counts.unacknowledged)} />
                  <Fact label="Waiting to send" value={String(data.queue.counts.localPending + data.queue.counts.sending)} />
                  <Fact label="Retry pending" value={String(data.queue.counts.retryPending)} />
                  <Fact label="Sign-in required" value={String(data.queue.counts.authRequired)} />
                  <Fact label="Conflicts" value={String(data.queue.counts.conflict)} />
                  <Fact label="Quarantined" value={String(data.queue.counts.quarantined)} />
                  <Fact label="Confirmed, kept on device" value={String(data.queue.counts.acknowledgedRetained)} />
                  <Fact
                    label="Categories"
                    value={Object.entries(data.queue.categories ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">No device report in the last {data.windowDays} days. Queue counts are unknown, not zero.</p>
              )}
              {data.lastFailure && (
                <p className="mt-4 text-sm">
                  Last reason-coded failure: <span className="font-mono">{data.lastFailure.reasonCode}</span> ({data.lastFailure.source}
                  {data.lastFailure.verdict ? `, ${data.lastFailure.verdict}` : ""}, {data.lastFailure.category}) at {when(data.lastFailure.at)}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
              <h2 className="text-lg font-semibold">Unconfirmed operations</h2>
              {data.operations.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{data.queue.counts ? "None in the latest device report." : "Unknown: no device report."}</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-[var(--ll-text-faint)]">
                      <tr><th className="py-2 pr-3">Operation</th><th className="pr-3">Category</th><th className="pr-3">Device state</th><th className="pr-3">Reason</th><th className="pr-3">Age</th><th className="pr-3">Retries</th><th>Server</th></tr>
                    </thead>
                    <tbody>
                      {data.operations.map((op) => (
                        <tr key={op.operationId} className="border-t border-[var(--ll-border)]">
                          <td className="py-2 pr-3 font-mono text-xs">{op.operationId.slice(0, 12)}</td>
                          <td className="pr-3">{op.category}</td>
                          <td className="pr-3 font-mono text-xs">{op.queueState}</td>
                          <td className="pr-3 font-mono text-xs">{op.reasonCode ?? "-"}</td>
                          <td className="pr-3">{duration(op.ageSeconds)}</td>
                          <td className="pr-3">{op.retryCount}</td>
                          <td>{op.serverVerdict ? `Received: ${op.serverVerdict}` : "No server record in window"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
              <h2 className="text-lg font-semibold">Recent server verdicts</h2>
              {data.recentServerOutcomes.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">No per-operation server verdicts recorded in the last {data.windowDays} days.</p>
              ) : (
                <ul className="mt-3 space-y-1 text-sm">
                  {data.recentServerOutcomes.map((o, index) => (
                    <li key={`${o.operationId ?? "op"}-${index}`}>
                      <span className="font-mono text-xs">{o.operationId?.slice(0, 12) ?? "unidentified"}</span> {o.category}: <strong>{o.verdict}</strong>
                      {o.reasonCode ? <span className="font-mono text-xs"> ({o.reasonCode})</span> : null} at {when(o.at)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
