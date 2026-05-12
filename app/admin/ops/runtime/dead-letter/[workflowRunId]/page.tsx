import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";
import { prisma } from "@/lib/db";
import { listOperatorNotes } from "@/lib/autonomous/operatorIncidentNoteService";
import { getWorkflowExecutionGraph } from "@/lib/autonomous/workflowExecutionGraphService";

export const dynamic = "force-dynamic";

const REPLAY_ELIGIBLE_ERROR_CODES = new Set([
  "workflow_timeout",
  "lock_conflict",
  "transient_db_error",
  "queue_timeout",
  "sqs_send_failed",
]);

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export default async function DeadLetterDetailPage({
  params,
}: {
  params: { workflowRunId: string };
}) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const workflowRun = await (prisma as any).workflowRun.findUnique({
    where: { id: params.workflowRunId },
  });
  if (!workflowRun) notFound();

  if (!user.isPlatformAdmin && workflowRun.schoolId !== user.schoolId) redirect("/");

  const [notes, graph] = await Promise.all([
    listOperatorNotes(params.workflowRunId),
    getWorkflowExecutionGraph(params.workflowRunId).catch(() => null),
  ]);

  const replayEligible =
    workflowRun.lastErrorCode != null &&
    REPLAY_ELIGIBLE_ERROR_CODES.has(workflowRun.lastErrorCode);

  const quarantined =
    (workflowRun.executionMetadata as any)?.quarantined === true ||
    workflowRun.lastErrorCode === "stuck_workflow_exhausted";

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime/dead-letter">
            ← Dead-Letter List
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Dead-Letter Detail</h1>
          <p className="mt-1 font-mono text-xs text-[var(--ll-text-faint)]">
            {params.workflowRunId}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Status", value: workflowRun.status },
            {
              label: "Replay eligible",
              value: replayEligible ? "Yes" : "No",
              highlight: replayEligible ? "text-sky-400" : undefined,
            },
            {
              label: "Quarantined",
              value: quarantined ? "Yes" : "No",
              highlight: quarantined ? "text-red-400" : undefined,
            },
          ].map(({ label, value, highlight }) => (
            <div
              key={label}
              className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
                {label}
              </div>
              <div className={`mt-2 text-xl font-semibold ${highlight ?? ""}`}>{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-2">
          <h2 className="text-lg font-semibold">Failure Details</h2>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>Workflow type: <strong>{workflowRun.workflowType}</strong></div>
            <div>Risk level: {workflowRun.riskLevel}</div>
            <div>
              Attempt: {workflowRun.attempt} / {workflowRun.maxAttempts}
            </div>
            <div>Dead-lettered: {formatDate(workflowRun.deadLetteredAt)}</div>
            {workflowRun.lastErrorCode && (
              <div className="col-span-2">
                Error code:{" "}
                <span className="font-mono text-red-400">{workflowRun.lastErrorCode}</span>
              </div>
            )}
            {workflowRun.lastErrorMessage && (
              <div className="col-span-2 text-[var(--ll-text-muted)]">
                {workflowRun.lastErrorMessage}
              </div>
            )}
          </div>
        </section>

        {graph && (
          <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-3">
            <h2 className="text-lg font-semibold">
              Execution Graph
              <span className="ml-2 text-sm font-normal text-[var(--ll-text-muted)]">
                {graph.nodeCount} nodes
              </span>
            </h2>
            <div className="divide-y divide-[var(--ll-border)] text-sm">
              {graph.nodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <span className="mr-2 rounded bg-[var(--ll-surface)] px-1.5 py-0.5 font-mono text-xs text-[var(--ll-text-muted)]">
                      {node.type}
                    </span>
                    <span>{node.label}</span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-xs ${
                      node.status === "failed" || node.status === "dead_lettered"
                        ? "text-red-400"
                        : node.status === "succeeded"
                        ? "text-green-400"
                        : "text-[var(--ll-text-muted)]"
                    }`}
                  >
                    {node.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Operator Notes
              <span className="ml-2 text-sm font-normal text-[var(--ll-text-muted)]">
                {notes.length}
              </span>
            </h2>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">
              No investigation notes yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--ll-border)] text-sm">
              {notes.map((note: any) => (
                <div key={note.id} className="py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[var(--ll-surface)] px-1.5 py-0.5 font-mono text-xs">
                      {note.noteType}
                    </span>
                    {note.severity && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          note.severity === "CRITICAL"
                            ? "bg-red-900/40 text-red-300"
                            : note.severity === "HIGH"
                            ? "bg-orange-900/40 text-orange-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {note.severity}
                      </span>
                    )}
                    <span
                      className={`ml-auto text-xs ${
                        note.status === "RESOLVED" ? "text-green-400" : "text-[var(--ll-text-muted)]"
                      }`}
                    >
                      {note.status}
                    </span>
                  </div>
                  <p className="text-[var(--ll-text)]">{note.body}</p>
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    {note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm space-y-2">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/ops/workflows/${params.workflowRunId}`}
              className="rounded border border-[var(--ll-border)] px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]"
            >
              Full workflow detail →
            </Link>
            {replayEligible && (
              <Link
                href={`/admin/ops/workflows/${params.workflowRunId}/replay`}
                className="rounded bg-[var(--ll-yellow)] px-3 py-1.5 text-sm font-semibold text-black"
              >
                Open Replay Console →
              </Link>
            )}
          </div>
          {quarantined && (
            <p className="text-xs text-red-400 mt-2">
              This workflow is quarantined. Investigate the root cause before attempting replay.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
