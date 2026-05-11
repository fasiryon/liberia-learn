import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkflowReplayPlan } from "@/lib/autonomous/workflowReplayService";

export const dynamic = "force-dynamic";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded border border-[var(--ll-border)] bg-black/20 p-3 text-xs">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export default async function WorkflowExecutionDetailPage({
  params,
}: {
  params: { workflowRunId: string };
}) {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.workflowRunId },
  });
  if (!workflowRun) notFound();

  const [plan, traces, approvals] = await Promise.all([
    getWorkflowReplayPlan(workflowRun.id),
    prisma.executionTrace.findMany({
      where: { workflowRunId: workflowRun.id },
      orderBy: { startedAt: "asc" },
      take: 100,
    }),
    prisma.approvalRequest.findMany({
      where: { workflowRunId: workflowRun.id },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/admin/ops/workflows" className="text-sm underline">
          Back to workflows
        </Link>

        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
            Execution Detail
          </p>
          <h1 className="text-2xl font-semibold">{workflowRun.workflowType}</h1>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div>Status: {workflowRun.status}</div>
            <div>Risk: {workflowRun.riskLevel}</div>
            <div>Partition: {workflowRun.partitionKey}</div>
            <div>Trace: {workflowRun.traceId}</div>
            <div>Correlation: {workflowRun.correlationId}</div>
            <div>Updated: {formatDate(workflowRun.updatedAt)}</div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-semibold">Replay Visibility</h2>
            <JsonBlock
              value={{
                replaySafe: plan.replaySafe,
                sideEffectsBlockedByDefault: plan.sideEffectsBlockedByDefault,
                replayOfRunId: workflowRun.replayOfRunId,
                replayMode: workflowRun.replayMode,
                actionCount: plan.actions.length,
              }}
            />
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold">Failure Diagnostics</h2>
            <JsonBlock
              value={{
                lastErrorCode: workflowRun.lastErrorCode,
                lastErrorMessage: workflowRun.lastErrorMessage,
                attempt: workflowRun.attempt,
                maxAttempts: workflowRun.maxAttempts,
                nextRetryAt: workflowRun.nextRetryAt,
                deadLetteredAt: workflowRun.deadLetteredAt,
              }}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Checkpoints</h2>
          <div className="space-y-2">
            {plan.checkpoints.map((checkpoint: any) => (
              <div key={checkpoint.id} className="rounded border border-[var(--ll-border)] p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{checkpoint.checkpointKey}</strong>
                  <span>{formatDate(checkpoint.createdAt)}</span>
                </div>
                <div className="text-[var(--ll-text-muted)]">sequence {checkpoint.sequence}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Approvals</h2>
          <JsonBlock value={approvals} />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Trace Spans</h2>
          <JsonBlock value={traces} />
        </section>
      </div>
    </main>
  );
}

