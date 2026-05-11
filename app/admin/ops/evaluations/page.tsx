import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRecommendationPrecisionAnalytics } from "@/lib/autonomous/evaluation/recommendationOutcomeTracker";
import { getPilotOutcomeAnalytics } from "@/lib/autonomous/evaluation/pilotOutcomeAnalyticsService";

export const dynamic = "force-dynamic";

export default async function EvaluationDashboardPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const schoolId = user.isPlatformAdmin ? null : user.schoolId;
  const [precision, pilots] = await Promise.all([
    getRecommendationPrecisionAnalytics({ schoolId }),
    getPilotOutcomeAnalytics({ schoolId }),
  ]);
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous Evaluation</p>
          <h1 className="text-2xl font-semibold">Outcome Evaluation</h1>
        </header>
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Evaluations<br /><span className="text-2xl font-semibold">{precision.total}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Precision<br /><span className="text-2xl font-semibold">{precision.precision}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">False positives<br /><span className="text-2xl font-semibold">{precision.falsePositives}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Pilot effectiveness<br /><span className="text-2xl font-semibold">{pilots.effectiveness}</span></div>
        </section>
        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Pilot Evidence</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <div>Total low risk: {pilots.totalLowRisk}</div>
            <div>Pilots: {pilots.pilots}</div>
            <div>Executed: {pilots.executed}</div>
            <div>Failed: {pilots.failed}</div>
            <div>Draft-only: {pilots.draftOnly}</div>
          </div>
          <Link className="mt-4 inline-block underline" href="/admin/ops/false-positives">Review false positives</Link>
        </section>
      </div>
    </main>
  );
}

