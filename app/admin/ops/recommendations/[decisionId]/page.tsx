import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecommendationReviewPage({ params }: { params: { decisionId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const decision = await (prisma as any).agentDecision.findUnique({ where: { id: params.decisionId } });
  if (!decision || !String(decision.decisionType).startsWith("detector.recommendation.")) notFound();

  const payload = decision.decision ?? {};
  const explanation = decision.explanation ?? {};
  const actions = Array.isArray(payload.suggestedActions) ? payload.suggestedActions : [];
  const interventions = Array.isArray(payload.suggestedInterventions) ? payload.suggestedInterventions : [];
  const improvements = Array.isArray(payload.suggestedCurriculumImprovements) ? payload.suggestedCurriculumImprovements : [];
  const existingActions = await (prisma as any).actionExecution.findMany({
    where: { agentDecisionId: decision.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link href="/admin/ops/recommendations" className="text-sm underline">
            Back to queue
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{payload.title ?? decision.decisionType}</h1>
          <div className="mt-2 grid gap-2 text-sm text-[var(--ll-text-muted)] md:grid-cols-4">
            <div>Status: {decision.status}</div>
            <div>Risk: {decision.riskLevel}</div>
            <div>Confidence: {Math.round(Number(decision.confidence ?? 0) * 100)}%</div>
            <div>Approval: {decision.requiresApproval ? "required" : "not required"}</div>
          </div>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Recommendation</h2>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{payload.summary ?? "No summary recorded."}</p>
          <p className="mt-3 text-sm">
            Human approval remains required. This page does not execute actions, send messages, publish curriculum, or alter official records.
          </p>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Governed Action</h2>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Prepare this recommendation as an approval-gated action. Medium and high risk actions remain blocked until an authorized approver resolves the request.
          </p>
          <form method="post" action="/api/admin/ops/actions/from-recommendation" className="mt-3">
            <input type="hidden" name="agentDecisionId" value={decision.id} />
            <button className="rounded bg-[var(--ll-primary)] px-3 py-2 text-sm font-semibold text-white">Prepare action draft</button>
          </form>
          <div className="mt-4 space-y-2 text-sm">
            {existingActions.map((action: any) => (
              <div key={action.id} className="border-t border-[var(--ll-border)] pt-2">
                <Link className="font-medium underline" href={`/admin/ops/actions/${action.id}`}>{action.actionType}</Link>
                <span className="ml-3 text-[var(--ll-text-muted)]">{action.status} · {action.riskLevel}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-base font-semibold">Suggested Actions</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ll-text-muted)]">
              {actions.map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-base font-semibold">Interventions</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ll-text-muted)]">
              {interventions.length ? interventions.map((item: string) => <li key={item}>{item}</li>) : <li>No intervention draft suggested.</li>}
            </ul>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-base font-semibold">Curriculum</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ll-text-muted)]">
              {improvements.length ? improvements.map((item: string) => <li key={item}>{item}</li>) : <li>No curriculum draft suggested.</li>}
            </ul>
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Lineage</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div>Detector: {payload.detectorId ?? "unknown"}</div>
            <div>Finding: {payload.findingType ?? "unknown"}</div>
            <div>Workflow: <Link className="underline" href={`/admin/ops/detectors/executions/${decision.workflowRunId}`}>{decision.workflowRunId}</Link></div>
            <div>Trace: {decision.traceId ?? "n/a"}</div>
            <div>Target: {payload.targetType ?? "target"}:{payload.targetId ?? "unknown"}</div>
            <div>Window: {payload.windowKey ?? "n/a"}</div>
          </div>
          <Link className="mt-4 inline-block text-sm underline" href={`/admin/ops/detectors/evidence/${decision.id}`}>
            Inspect evidence
          </Link>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Explainability</h2>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{explanation.explanation ?? "No explanation recorded."}</p>
        </section>
      </div>
    </main>
  );
}
