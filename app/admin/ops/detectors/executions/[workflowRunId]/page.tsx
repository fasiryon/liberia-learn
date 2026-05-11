import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DetectorExecutionDetailPage({ params }: { params: { workflowRunId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const workflowRun = await (prisma as any).workflowRun.findUnique({ where: { id: params.workflowRunId } });
  if (!workflowRun || !String(workflowRun.workflowType).startsWith("detector.")) notFound();

  const [steps, checkpoints, traces, decisions] = await Promise.all([
    (prisma as any).workflowStep.findMany({ where: { workflowRunId: workflowRun.id }, orderBy: { sequence: "asc" } }),
    (prisma as any).workflowCheckpoint.findMany({ where: { workflowRunId: workflowRun.id }, orderBy: { sequence: "asc" } }),
    (prisma as any).executionTrace.findMany({ where: { workflowRunId: workflowRun.id }, orderBy: { startedAt: "asc" } }),
    (prisma as any).agentDecision.findMany({ where: { workflowRunId: workflowRun.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <Link href="/admin/ops/detectors" className="text-sm underline">
            Back to detectors
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{workflowRun.workflowType}</h1>
          <div className="mt-2 grid gap-2 text-sm text-[var(--ll-text-muted)] md:grid-cols-3">
            <div>Status: {workflowRun.status}</div>
            <div>Risk: {workflowRun.riskLevel}</div>
            <div>Trace: {workflowRun.traceId}</div>
            <div>Correlation: {workflowRun.correlationId}</div>
            <div>Tenant: {workflowRun.schoolId ?? workflowRun.districtId ?? "aggregate"}</div>
            <div>Replay: {workflowRun.isReplay ? workflowRun.replayMode : "no"}</div>
          </div>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <div className="mt-3 space-y-3">
            {decisions.map((decision: any) => (
              <div key={decision.id} className="border-t border-[var(--ll-border)] pt-3">
                <Link className="font-medium underline" href={`/admin/ops/recommendations/${decision.id}`}>
                  {decision.decision?.title ?? decision.decisionType}
                </Link>
                <div className="text-sm text-[var(--ll-text-muted)]">
                  {decision.status} · confidence {Math.round(Number(decision.confidence ?? 0) * 100)}% · approval required
                </div>
                <Link className="text-xs underline" href={`/admin/ops/detectors/evidence/${decision.id}`}>
                  Inspect evidence
                </Link>
              </div>
            ))}
            {decisions.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No recommendations for this run.</p> : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Workflow Steps</h2>
            <div className="mt-3 space-y-2 text-sm">
              {steps.map((step: any) => (
                <div key={step.id} className="border-t border-[var(--ll-border)] py-2">
                  <div className="font-medium">{step.sequence}. {step.stepKey}</div>
                  <div className="text-[var(--ll-text-muted)]">{step.status}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Execution Traces</h2>
            <div className="mt-3 space-y-2 text-sm">
              {traces.map((trace: any) => (
                <div key={trace.id} className="border-t border-[var(--ll-border)] py-2">
                  <div className="font-medium">{trace.spanType}: {trace.spanName}</div>
                  <div className="text-[var(--ll-text-muted)]">{trace.status} · {trace.durationMs ?? 0}ms</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Checkpoints</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {checkpoints.map((checkpoint: any) => (
              <div key={checkpoint.id} className="border-t border-[var(--ll-border)] py-2">
                <div className="font-medium">{checkpoint.sequence}. {checkpoint.checkpointKey}</div>
                <div className="text-[var(--ll-text-muted)]">{checkpoint.status}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
