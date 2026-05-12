import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { getManualRuntimeRunDetail } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded border border-[var(--ll-border)] bg-black/20 p-3 text-xs">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default async function RuntimeRunDetailPage({ params }: { params: { runId: string } }) {
  await requirePlatformAdmin();
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");
  const run = await getManualRuntimeRunDetail(params.runId);
  if (!run) notFound();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime/runs">Back to run history</Link>
          <h1 className="mt-2 text-2xl font-semibold">{run.kind}</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            {run.pipeline} run by {run.actor.name ?? run.actor.id ?? "system"} at {formatDate(run.ranAt)}.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Status", value: run.status },
            { label: "Processed", value: run.processedCount },
            { label: "Skipped", value: run.skippedCount },
            { label: "Failed", value: run.failedCount },
          ].map((item) => (
            <div key={item.label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Run Summary</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div>Duration: {run.durationMs}ms</div>
              <div>Dry run: {run.dryRun ? "yes" : "no"}</div>
              <div>Reason: {run.reason ?? "n/a"}</div>
              <div>AuditLog: {run.auditLog.id}</div>
              <div>Trace: {run.auditLog.traceId ?? "n/a"}</div>
            </dl>
          </div>

          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Linked Operations</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {run.links.workflows.map((link) => <Link key={link.href} className="underline" href={link.href}>Workflow {link.id}</Link>)}
              {run.links.replayConsoles.map((link) => <Link key={link.href} className="underline" href={link.href}>Replay {link.id}</Link>)}
              {run.links.deadLetters.map((link) => <Link key={link.href} className="underline" href={link.href}>Dead letter {link.id}</Link>)}
              {run.links.evaluations.map((link) => <Link key={link.href} className="underline" href={link.href}>Evaluation {link.id}</Link>)}
              {run.links.approvals.map((link) => <Link key={link.href} className="underline" href={link.href}>Approval {link.id}</Link>)}
              {run.links.workflows.length + run.links.replayConsoles.length + run.links.deadLetters.length + run.links.evaluations.length + run.links.approvals.length === 0 ? (
                <p className="text-[var(--ll-text-muted)]">No affected workflow, approval, evaluation, or dead-letter ids were recorded in this run result.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Linked AuditLog Records</h2>
          <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
            {run.linkedAuditLogs.map((log) => (
              <div key={log.id} className="py-2">
                <p className="font-medium">{log.action}</p>
                <p className="font-mono text-xs text-[var(--ll-text-muted)]">
                  {log.id} - {log.resourceType ?? "n/a"}:{log.resourceId ?? "n/a"} - {formatDate(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">ExecutionTrace Records</h2>
          {run.linkedExecutionTraces.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No linked execution traces found for this run.</p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
              {run.linkedExecutionTraces.map((trace) => (
                <div key={trace.id} className="py-2">
                  <p className="font-medium">{trace.spanName} - {trace.status}</p>
                  <p className="font-mono text-xs text-[var(--ll-text-muted)]">
                    {trace.traceId} - {trace.workflowRunId ?? "no workflow"} - {formatDate(trace.startedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="mb-2 text-lg font-semibold">Sanitized Result Payload</h2>
          <JsonBlock value={run.result} />
        </section>
      </div>
    </main>
  );
}
