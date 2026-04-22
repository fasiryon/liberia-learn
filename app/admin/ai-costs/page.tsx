import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAiCostDashboardData } from "@/lib/ai/costSummary";

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export const dynamic = "force-dynamic";

export default async function AdminAiCostsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/");
  }
  if (!user.schoolId && !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const data = await getAiCostDashboardData({
    schoolId: user.schoolId ?? null,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#0f766e22,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn AI Ops</p>
          <h1 className="text-3xl font-bold">AI Cost Guardrails</h1>
          <p className="max-w-3xl text-sm text-[var(--ll-text-muted)]">
            Daily AI spend, fallback behavior, and monthly projection for governed tutor,
            teacher assist, grading, and curriculum workflows.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Monthly Budget</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--ll-surface)]">
              <div
                className="h-full rounded-full bg-teal-400"
                style={{ width: `${Math.min(data.thisMonth.percentUsed, 100)}%` }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-[var(--ll-text)]">
                  {formatUsd(data.thisMonth.totalCostUsd)}
                </p>
                <p className="text-sm text-[var(--ll-text-muted)]">
                  of {formatUsd(data.thisMonth.budgetCapUsd)} monthly cap
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-teal-300">
                  {data.thisMonth.percentUsed.toFixed(1)}%
                </p>
                <p className="text-sm text-[var(--ll-text-muted)]">
                  Projected month end {formatUsd(data.thisMonth.projectedMonthEndUsd)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Fallback Rate Today</p>
            <p className="mt-3 text-3xl font-bold text-[var(--ll-text)]">
              {formatPercent(data.today.fallbackRate)}
            </p>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              {data.today.fallbackCount} fallbacks across {data.today.requestCount} requests
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--ll-text-faint)]">Cost today</p>
                <p className="mt-1 font-semibold text-[var(--ll-text)]">
                  {formatUsd(data.today.totalCostUsd)}
                </p>
              </div>
              <div>
                <p className="text-[var(--ll-text-faint)]">Tokens today</p>
                <p className="mt-1 font-semibold text-[var(--ll-text)]">
                  {data.today.totalTokens.toLocaleString("en-US")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data.today.byFeature).map(([feature, summary]) => (
            <div key={feature} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{feature}</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">
                {formatUsd(summary.costUsd)}
              </p>
              <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                {summary.requestCount} requests, {summary.fallbackCount} fallbacks
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Top Schools By Spend</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Today</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.today.topSchoolsBySpend.length === 0 ? (
                <p className="text-sm text-[var(--ll-text-muted)]">
                  {user.isPlatformAdmin
                    ? "No school spend recorded today."
                    : "School-level spend is scoped to your tenant."}
                </p>
              ) : (
                data.today.topSchoolsBySpend.map((school) => (
                  <div
                    key={school.schoolId}
                    className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-[var(--ll-text)]">{school.name}</p>
                      <p className="text-xs text-[var(--ll-text-faint)]">{school.schoolId}</p>
                    </div>
                    <p className="font-semibold text-teal-300">{formatUsd(school.costUsd)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Alerts</p>
            <div className="mt-4 space-y-3">
              {data.alerts.length === 0 ? (
                <p className="text-sm text-[var(--ll-text-muted)]">No active budget alerts.</p>
              ) : (
                data.alerts.map((alert) => (
                  <div
                    key={alert}
                    className="rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm text-[var(--ll-yellow)]"
                  >
                    {alert}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
