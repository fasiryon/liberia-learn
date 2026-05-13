import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getAutonomousEffectivenessDashboard,
  parseEffectivenessDateRange,
} from "@/lib/autonomous/optimization/effectivenessDashboardService";

export const dynamic = "force-dynamic";

type SearchParams = {
  from?: string;
  to?: string;
};

function pct(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function int(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function metricCard(label: string, value: string, detail: string, href?: string) {
  const content = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[var(--ll-text-muted)]">{detail}</div>
    </>
  );
  return (
    <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
      {href ? <Link href={href}>{content}</Link> : content}
    </div>
  );
}

function executiveStatus(dashboard: Awaited<ReturnType<typeof getAutonomousEffectivenessDashboard>>) {
  const m = dashboard.metrics;
  const sparse = dashboard.warnings.length > 0;
  const negativeOutcomes = m.implementationOutcomes.negative;
  const mixedOutcomes = m.implementationOutcomes.mixed;
  const workflowOk = (m.workflowSuccessRate.value ?? 0) >= 0.8;
  const actionOk = (m.actionExecutionSuccessRate.value ?? 0) >= 0.8;
  const falsePositiveOk = m.falsePositiveRate.value === null || m.falsePositiveRate.value <= 0.25;
  const closureOk = m.evaluationClosureRate.value === null || m.evaluationClosureRate.value >= 0.5;

  if (sparse) {
    return {
      label: "Sparse evidence",
      tone: "border-amber-500/50 bg-amber-500/10 text-amber-100",
      text: "Persisted data is limited, so the system cannot yet be called working or failing with confidence.",
    };
  }
  if (negativeOutcomes > 0 || !workflowOk || !actionOk || !falsePositiveOk) {
    return {
      label: "Needs attention",
      tone: "border-red-500/50 bg-red-500/10 text-red-100",
      text: "The persisted evidence shows reliability, execution, false-positive, or outcome issues.",
    };
  }
  if (mixedOutcomes > 0 || !closureOk) {
    return {
      label: "Mixed",
      tone: "border-sky-500/50 bg-sky-500/10 text-sky-100",
      text: "The system is producing useful signals, but closure or implementation outcomes are not consistently positive.",
    };
  }
  return {
    label: "Working",
    tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
    text: "The persisted evidence shows stable workflows, successful actions, acceptable false positives, and closed positive outcomes.",
  };
}

function scopeForUser(user: any) {
  const role = String(user.role ?? "");
  const isMoe = role === "MOE_OFFICIAL" || role === "MOE_SUPER_ADMIN" || role === "DISTRICT_ADMIN";
  if (user.isPlatformAdmin) return { scope: {}, label: "National platform aggregate" };
  if (isMoe) return { scope: { aggregateOnly: true }, label: "MOE aggregate-only view" };
  return { scope: { schoolId: user.schoolId ?? "__none__" }, label: "School tenant view" };
}

export default async function AutonomousEffectivenessDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const allowed =
    user.isPlatformAdmin ||
    user.role === "ADMIN" ||
    user.role === "MOE_OFFICIAL" ||
    user.role === "DISTRICT_ADMIN" ||
    String(user.role) === "MOE_SUPER_ADMIN";
  if (!allowed) redirect("/");

  const range = parseEffectivenessDateRange({ from: searchParams.from, to: searchParams.to });
  const { scope, label } = scopeForUser(user);
  const dashboard = await getAutonomousEffectivenessDashboard({ scope, range });
  const status = executiveStatus(dashboard);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Effectiveness Executive Summary</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              Real persisted data only. {label}. Window: {dateInputValue(range.from)} to {dateInputValue(range.to)}.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-3 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-sm">
            <label className="grid gap-1">
              <span className="text-xs text-[var(--ll-text-muted)]">From</span>
              <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="from" defaultValue={dateInputValue(range.from)} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[var(--ll-text-muted)]">To</span>
              <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="to" defaultValue={dateInputValue(range.to)} />
            </label>
            <button className="rounded border border-[var(--ll-border)] px-3 py-1.5 font-medium" type="submit">Apply</button>
          </form>
        </header>

        <section className={`rounded border p-5 ${status.tone}`}>
          <div className="text-sm font-semibold uppercase tracking-wide">Executive read</div>
          <div className="mt-2 text-3xl font-semibold">{status.label}</div>
          <p className="mt-2 max-w-3xl text-sm">{status.text}</p>
        </section>

        {dashboard.warnings.length > 0 ? (
          <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4">
            <h2 className="text-lg font-semibold text-amber-100">Sparse-Data Warnings</h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-50">
              {dashboard.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCard("Total workflows", int(dashboard.metrics.totalWorkflows), "WorkflowRun rows in the selected window.", dashboard.links.workflows)}
          {metricCard("Workflow success", pct(dashboard.metrics.workflowSuccessRate.value), `${dashboard.counts.completedWorkflows}/${dashboard.counts.completedWorkflows + dashboard.counts.failedWorkflows} terminal runs succeeded.`, dashboard.links.workflows)}
          {metricCard("Workflow failure", pct(dashboard.metrics.workflowFailureRate.value), `${dashboard.counts.failedWorkflows}/${dashboard.counts.completedWorkflows + dashboard.counts.failedWorkflows} terminal runs failed or stopped.`, dashboard.links.workflows)}
          {metricCard("Detector recommendations", int(dashboard.metrics.detectorRecommendationVolume), "AgentDecision detector recommendation rows.", dashboard.links.recommendations)}
          {metricCard("Recommendation acceptance", pct(dashboard.metrics.recommendationAcceptanceRate.value), `${dashboard.counts.acceptedEvaluations}/${dashboard.counts.evaluations} persisted evaluations accepted, executed, or improved.`, dashboard.links.evaluations)}
          {metricCard("False-positive rate", pct(dashboard.metrics.falsePositiveRate.value), `${dashboard.counts.falsePositiveEvaluations}/${dashboard.counts.evaluations} evaluations marked false positive.`, dashboard.links.evaluations)}
          {metricCard("Approval throughput", int(dashboard.metrics.approvalThroughput), `${dashboard.counts.decidedApprovals}/${dashboard.counts.approvals} approval requests decided.`, dashboard.links.approvals)}
          {metricCard("Action success", pct(dashboard.metrics.actionExecutionSuccessRate.value), `${dashboard.counts.executedActions}/${dashboard.counts.executedActions + dashboard.counts.failedActions} terminal actions succeeded.`, dashboard.links.approvals)}
          {metricCard("Rollback rate", pct(dashboard.metrics.rollbackRate.value), `${dashboard.counts.rollbackCount}/${dashboard.counts.actions} actions completed rollback.`, dashboard.links.approvals)}
          {metricCard("Evaluation closure", pct(dashboard.metrics.evaluationClosureRate.value), `${dashboard.counts.closedEvaluations}/${dashboard.counts.postChangePlans} post-change evaluations closed.`, dashboard.links.outcomes)}
          {metricCard("Average confidence", dashboard.metrics.averageConfidenceScore === null ? "n/a" : pct(dashboard.metrics.averageConfidenceScore), "Average detector recommendation confidence.", dashboard.links.recommendations)}
          {metricCard("Memory updates", int(dashboard.metrics.memoryUpdatesCreated), "autonomous.memory.recorded events created.", dashboard.links.memory)}
          {metricCard("Optimization proposals", int(dashboard.metrics.optimizationProposalsCreated), "autonomous.optimization.proposed events created.", dashboard.links.optimization)}
          {metricCard("Approved proposals", int(dashboard.metrics.approvedOptimizationProposals), "Proposals whose latest review is APPROVED.", dashboard.links.optimization)}
          {metricCard("Product signals", int(dashboard.metrics.signalEventsIngested), `${dashboard.metrics.lowDataSignalWarnings} low-data signal warnings.`, dashboard.links.signals)}
          {metricCard("Evidence coverage", dashboard.metrics.detectorEvidenceCoverage === null ? "n/a" : pct(dashboard.metrics.detectorEvidenceCoverage), "Detector recommendations backed by LearningEvent evidence.", dashboard.links.signals)}
          {metricCard("Positive outcomes", int(dashboard.metrics.implementationOutcomes.positive), "Closed implementation outcomes marked POSITIVE.", dashboard.links.changeRequests)}
          {metricCard("Negative / mixed", `${dashboard.metrics.implementationOutcomes.negative} / ${dashboard.metrics.implementationOutcomes.mixed}`, "Closed implementation outcomes marked NEGATIVE or MIXED.", dashboard.links.changeRequests)}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Post-Change Effectiveness Trends</h2>
            <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
              {dashboard.recent.postChangeTrends.map((trend) => (
                <div key={trend.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <Link className="font-medium underline" href={`/admin/ops/optimization/change-requests/${trend.changeRequestId}/post-change-eval`}>
                      {trend.title}
                    </Link>
                    <p className="text-[var(--ll-text-muted)]">
                      {trend.feedbackLoopStatus} · outcome {trend.overallOutcome ?? "pending"} · confidence {trend.confidenceScore === null || trend.confidenceScore === undefined ? "n/a" : pct(trend.confidenceScore)}
                    </p>
                  </div>
                  <div className="text-xs text-[var(--ll-text-muted)]">
                    precision {trend.deltas.detectorPrecision ?? "n/a"} · fp {trend.deltas.falsePositiveRate ?? "n/a"} · acceptance {trend.deltas.recommendationAcceptanceRate ?? "n/a"}
                  </div>
                </div>
              ))}
              {dashboard.recent.postChangeTrends.length === 0 ? <p className="py-4 text-sm text-[var(--ll-text-muted)]">No post-change evaluations in this window.</p> : null}
            </div>
          </div>

          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Underlying Records</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.workflows}>Workflow runs</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.recommendations}>Recommendations</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.approvals}>Approvals</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.evaluations}>Evaluations</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.outcomes}>Outcomes</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.memory}>Memory updates</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href={dashboard.links.signals}>Signal coverage</Link>
            </div>
            <h2 className="mt-5 text-lg font-semibold">Runtime Operations</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime">Runtime health</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/recovery">Workflow failures</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/dead-letter">Dead-letter items</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/optimization/evaluation-windows">Evaluation windows</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/stale-approvals">Approval SLA</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/cron">Cron run history</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
