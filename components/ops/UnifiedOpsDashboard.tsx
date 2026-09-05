import type { OperationalPanel, OperationalSnapshot, OperationalStatus } from "@/lib/ops/operationalSnapshot";

const STATUS_CLASS: Record<OperationalStatus, string> = {
  HEALTHY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  DEGRADED: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  BLOCKED: "border-red-500/50 bg-red-500/10 text-red-100",
  UNKNOWN: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};

function display(input: unknown) {
  if (input === null || input === undefined || input === "") return "Unknown";
  if (typeof input === "boolean") return input ? "Yes" : "No";
  return String(input);
}

function sourceAge(timestamp: string | null, generatedAt: string) {
  if (!timestamp) return "No source timestamp";
  const seconds = Math.max(0, Math.round((Date.parse(generatedAt) - Date.parse(timestamp)) / 1000));
  return seconds < 60 ? `${seconds}s old` : seconds < 3600 ? `${Math.floor(seconds / 60)}m old` : `${Math.floor(seconds / 3600)}h old`;
}

function Panel({ title, panel, rows }: { title: string; panel: OperationalPanel<unknown>; rows: Array<[string, unknown]> }) {
  return <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
    <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-[var(--ll-text)]">{title}</h2><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CLASS[panel.status]}`}>{panel.status}</span></div>
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{rows.map(([label, value]) => <div key={label}><dt className="text-[var(--ll-text-faint)]">{label}</dt><dd className="font-medium text-[var(--ll-text)]">{display(value)}</dd></div>)}</dl>
    <div className="mt-4 border-t border-[var(--ll-border)] pt-3 text-xs text-[var(--ll-text-faint)]"><p>{panel.provenance.sourceSubsystem} / {panel.provenance.definitionVersion}</p><p>{panel.provenance.freshness}: {sourceAge(panel.provenance.sourceTimestamp, panel.provenance.generatedAt)}</p>{panel.error ? <p className="text-amber-200">{panel.error}</p> : null}</div>
  </section>;
}

export function UnifiedOpsDashboard({ snapshot }: { snapshot: OperationalSnapshot }) {
  const p = snapshot.panels;
  const activeAlerts = snapshot.alerts.filter((alert) => alert.state !== "RESOLVED");
  return <main className="space-y-6" data-testid="unified-ops-dashboard">
    <header className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[var(--ll-text-faint)]">NR-15 operational command surface</p><h1 className="mt-2 text-2xl font-bold text-[var(--ll-text)]">Unified Operations</h1><p className="mt-1 text-sm text-[var(--ll-text-muted)]">{snapshot.scope.kind === "NATIONAL" ? "Authorized national aggregate" : `School scope ${snapshot.scope.schoolId}`}</p></div><span className={`rounded-lg border px-4 py-2 text-lg font-bold ${STATUS_CLASS[snapshot.status]}`}>{snapshot.status}</span></div><p className="mt-4 text-xs text-[var(--ll-text-faint)]">Snapshot v{snapshot.version}, generated {new Date(snapshot.generatedAt).toLocaleString("en-LR")}. Missing evidence remains UNKNOWN.</p></header>
    <section aria-labelledby="ops-alerts"><div className="mb-3 flex items-center justify-between"><h2 id="ops-alerts" className="text-lg font-semibold text-[var(--ll-text)]">Open alerts</h2><span className="text-sm text-[var(--ll-text-muted)]">{activeAlerts.length} active</span></div><div className="space-y-2">{activeAlerts.map((alert) => <article key={alert.fingerprint} className={`rounded-lg border p-4 ${alert.severity === "CRITICAL" ? STATUS_CLASS.BLOCKED : STATUS_CLASS.DEGRADED}`}><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{alert.alertId}</p><p className="text-xs">{alert.severity} / {alert.state}</p></div><p className="mt-1 text-sm">{alert.recommendedAction}</p><p className="mt-2 text-xs opacity-80">Owner: {alert.owner}. Observed {alert.observations} time(s). Fingerprint {alert.fingerprint.slice(0, 12)}.</p></article>)}{activeAlerts.length === 0 ? <p className="rounded-lg border border-[var(--ll-border)] p-4 text-sm text-[var(--ll-text-muted)]">No active alerts from currently available evidence.</p> : null}</div></section>
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Panel title="System health" panel={p.system} rows={[["Runtime", p.system.data?.runtime], ["Database", p.system.data?.database], ["DB latency", p.system.data ? `${p.system.data.databaseLatencyMs} ms` : null], ["Redis", p.system.data?.redis], ["Commit", p.system.data?.commitSha], ["Environment", p.system.data?.environment]]} />
      <Panel title="Queue and workers" panel={p.queues} rows={[["Pending", p.queues.data?.pending], ["Processing", p.queues.data?.processing], ["Retrying", p.queues.data?.retrying], ["DLQ", p.queues.data?.dlq], ["Unknown jobs", p.queues.data?.unknownJobs], ["Worker", p.queues.data?.workerAvailability]]} />
      <Panel title="Offline synchronization" panel={p.offline} rows={[["Queued", p.offline.data?.queued], ["Retrying", p.offline.data?.retrying], ["Auth held", p.offline.data?.authHeld], ["Conflicts", p.offline.data?.conflicts], ["Dead letter", p.offline.data?.deadLetter], ["Isolation failures", p.offline.data?.isolationFailures]]} />
      <Panel title="Curriculum governance" panel={p.curriculum} rows={[["Pending review", p.curriculum.data?.pendingReview], ["High risk", p.curriculum.data?.highRiskReview], ["Stale", p.curriculum.data?.staleReview], ["Revision needed", p.curriculum.data?.revisionNeeded], ["Revoked", p.curriculum.data?.revokedContent], ["Reviewer activation", p.curriculum.data?.reviewerActivation]]} />
      <Panel title="AI quality (P7-A)" panel={p.aiQuality} rows={[["Helpfulness", p.aiQuality.data?.tutorHelpfulness], ["Grounding", p.aiQuality.data?.grounding], ["Hallucination", p.aiQuality.data?.hallucination], ["Moderation FP", p.aiQuality.data?.moderationFalsePositive], ["Moderation FN", p.aiQuality.data?.moderationFalseNegative], ["Evidence", p.aiQuality.data?.evidenceState]]} />
      <Panel title="Experiments (P7-B)" panel={p.experiments} rows={[["Running", p.experiments.data?.running], ["Paused or stopped", p.experiments.data?.pausedOrStopped], ["SRM", p.experiments.data?.srm], ["Guardrail breaches", p.experiments.data?.guardrailBreaches], ["Early stop", p.experiments.data?.earlyStop], ["Assignments / exposures", p.experiments.data ? `${display(p.experiments.data.assignments)} / ${display(p.experiments.data.exposures)}` : null]]} />
      <Panel title="Quality operations (P7-C)" panel={p.qualityOperations} rows={[["Release gate", p.qualityOperations.data?.releaseGate], ["Open reviews", p.qualityOperations.data?.openReviewTasks], ["Stale reviews", p.qualityOperations.data?.staleReviewTasks], ["Calibration", p.qualityOperations.data?.calibration], ["Open incidents", p.qualityOperations.data?.openIncidents], ["Hard safety blocks", p.qualityOperations.data?.hardSafetyBlocks]]} />
      <Panel title="Tenant state" panel={p.tenants} rows={[["Active schools", p.tenants.data?.activeSchools], ["Inactive schools", p.tenants.data?.inactiveSchools], ["School status", p.tenants.data?.scopedSchoolStatus], ["Isolation failures", p.tenants.data?.isolationFailures]]} />
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-[var(--ll-text)]">Incidents</h2><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CLASS[p.incidents.status]}`}>{p.incidents.status}</span></div><div className="mt-4 space-y-3 text-sm">{p.incidents.data?.open.map((incident) => <div key={incident.id} className="rounded-lg border border-[var(--ll-border)] p-3"><p className="font-medium text-[var(--ll-text)]">{incident.severity}: {incident.subsystem}</p><p className="text-[var(--ll-text-muted)]">Owner: {display(incident.owner)} / {incident.evidenceRef}</p><p className="text-[var(--ll-text-faint)]">Detected {new Date(incident.detectedAt).toLocaleString("en-LR")}</p></div>)}{!p.incidents.data?.open.length ? <p className="text-[var(--ll-text-muted)]">No open incidents from available authorities.</p> : null}</div></section>
    </div>
    <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-[var(--ll-text)]">External readiness gates</h2><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CLASS[snapshot.readiness.status]}`}>{snapshot.readiness.status}</span></div><div className="mt-4 divide-y divide-[var(--ll-border)]">{snapshot.readiness.gates.map((gate) => <div key={gate.id} className="grid gap-1 py-3 md:grid-cols-[1fr_auto] md:gap-4"><div><p className="text-sm font-medium text-[var(--ll-text)]">{gate.label}</p><p className="text-xs text-[var(--ll-text-muted)]">{gate.evidence}</p></div><span className="text-xs font-semibold text-[var(--ll-text-muted)]">{gate.state}</span></div>)}</div></section>
    <aside className="rounded-lg border border-slate-500/40 bg-slate-500/10 p-4 text-sm text-slate-200">External notification delivery is not configured. This dashboard does not claim email, SMS, Slack, or pager delivery.</aside>
  </main>;
}


