import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAiQualityDashboardData } from "@/lib/aiQuality/dashboardData";
import { isAiQualityDashboardEnabled } from "@/lib/serverFlags";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function StatCard({
  label,
  value,
  detail,
  tone = "measured",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "measured" | "gap";
}) {
  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            tone === "measured"
              ? "bg-teal-400/20 text-teal-300"
              : "bg-amber-500/20 text-amber-300"
          }`}
        >
          {tone === "measured" ? "Measured" : "Not yet measurable"}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{detail}</p>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function AiQualityDashboardPage() {
  if (!isAiQualityDashboardEnabled()) {
    redirect("/admin");
  }

  const user = await requireUser();
  if (user.role !== "ADMIN" || !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const data = await getAiQualityDashboardData();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#0f766e22,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn AI Ops</p>
          <h1 className="text-3xl font-bold">AI Quality &amp; Safety</h1>
          <p className="max-w-3xl text-sm text-[var(--ll-text-muted)]">
            Real measurements of AI groundedness, curriculum alignment, and safety across the
            platform&apos;s AI surfaces. Metrics without real data show an honest
            &quot;not yet measurable&quot; state instead of a placeholder number.
          </p>
          <p className="text-xs text-[var(--ll-text-faint)]">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.groundedness.status === "measurable" ? (
            <StatCard
              label="Hallucination / groundedness"
              value={formatPercent(data.groundedness.avgGroundingScore * 100)}
              detail={`avg recall@5 ${formatPercent(data.groundedness.avgRecallAt5 * 100)} · fallback rate ${formatPercent(
                data.groundedness.fallbackRate * 100
              )} · ${data.groundedness.datasetSize} cases · last run ${new Date(
                data.groundedness.lastRunAt
              ).toLocaleDateString()}`}
            />
          ) : (
            <StatCard
              label="Hallucination / groundedness"
              value="--"
              detail={data.groundedness.reason}
              tone="gap"
            />
          )}

          <StatCard
            label="Curriculum-grounding coverage"
            value={formatPercent(data.curriculumGrounding.coveragePct)}
            detail={`${data.curriculumGrounding.checkedLessons.toLocaleString(
              "en-US"
            )} of ${data.curriculumGrounding.totalLessons.toLocaleString(
              "en-US"
            )} lessons checked against MOE standards`}
          />

          {data.citationCoverage.status === "measurable" ? (
            <StatCard
              label="Citation coverage (global assistant)"
              value={formatPercent(data.citationCoverage.coveragePct)}
              detail={`${data.citationCoverage.interactionsWithSources} of ${data.citationCoverage.totalInteractions} real interactions cited a source, last ${data.citationCoverage.windowDays} days. ${data.citationCoverage.scopeNote}`}
            />
          ) : (
            <StatCard
              label="Citation coverage (global assistant)"
              value="--"
              detail={`${data.citationCoverage.reason} ${data.citationCoverage.scopeNote}`}
              tone="gap"
            />
          )}

          <StatCard
            label="Age-safety checks"
            value="--"
            detail={data.ageSafety.reason}
            tone="gap"
          />

          <StatCard label="Bias checks" value="--" detail={data.biasCheck.reason} tone="gap" />

          <StatCard
            label="Learning correlation"
            value="--"
            detail={data.learningCorrelation.reason}
            tone="gap"
          />
        </section>

        {data.groundedness.status === "measurable" && data.groundedness.recentRuns.length > 1 && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
              Recent RAG eval runs
            </p>
            <div className="mt-4 space-y-2">
              {data.groundedness.recentRuns.map((run) => (
                <div
                  key={run.runAt}
                  className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3 text-sm"
                >
                  <span className="text-[var(--ll-text-muted)]">
                    {new Date(run.runAt).toLocaleString()}
                  </span>
                  <span className="font-semibold text-teal-300">
                    {formatPercent(run.avgGroundingScore * 100)} grounding
                  </span>
                  <span className={run.passed ? "text-teal-300" : "text-amber-300"}>
                    {run.passed ? "passed" : "failed"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
