import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAiCostDashboardData } from "@/lib/ai/costSummary";
import { isAiCostDashboardEnabled } from "@/lib/serverFlags";

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export const dynamic = "force-dynamic";

export default async function AdminAiCostsPage() {
  if (!isAiCostDashboardEnabled()) {
    redirect("/admin");
  }

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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Cost per interaction</p>
            <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">
              {data.today.requestCount > 0 ? formatUsd(data.today.costPerInteraction) : "—"}
            </p>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              {data.today.requestCount} AI calls today
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">7-day total cost</p>
            <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">
              {formatUsd(data.sevenDayTrend.reduce((sum, d) => sum + d.costUsd, 0))}
            </p>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              {data.sevenDayTrend.reduce((sum, d) => sum + d.requestCount, 0).toLocaleString("en-US")} calls in 7 days
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Most expensive feature</p>
            {(() => {
              const top = Object.entries(data.today.byFeature).sort(([, a], [, b]) => b.costUsd - a.costUsd)[0];
              return top ? (
                <>
                  <p className="mt-2 text-2xl font-bold capitalize text-[var(--ll-text)]">{top[0]}</p>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{formatUsd(top[1].costUsd)} today</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">No data yet</p>
              );
            })()}
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

        {data.sevenDayTrend.length > 0 && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">7-Day Cost Trend</p>
            <div className="mt-4 flex items-end gap-1.5" style={{ height: "80px" }}>
              {data.sevenDayTrend.map((day) => {
                const maxCost = Math.max(...data.sevenDayTrend.map((d) => d.costUsd), 0.001);
                const heightPct = Math.max((day.costUsd / maxCost) * 100, 4);
                return (
                  <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-teal-400/60 transition-all group-hover:bg-teal-400"
                      style={{ height: `${heightPct}%` }}
                    />
                    <p className="text-[9px] text-[var(--ll-text-faint)]">
                      {day.date.slice(5)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Optimization Recommendations</p>
          <div className="mt-4 space-y-2">
            {data.recommendations.map((rec) => (
              <div
                key={rec}
                className="flex items-start gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-3"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-teal-400" />
                <p className="text-sm text-[var(--ll-text-muted)]">{rec}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Current Cost-Saving Settings</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-3">
              <p className="text-[10px] text-[var(--ll-text-faint)]">Response Caching</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">Read-only</p>
              <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">Configure via ENABLE_RAG_TUTOR env var</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-3">
              <p className="text-[10px] text-[var(--ll-text-faint)]">Model Routing</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">Groq → OpenAI fallback</p>
              <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">Fast tier uses llama-3.1-8b-instant</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-3">
              <p className="text-[10px] text-[var(--ll-text-faint)]">Max Output Tokens</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">512 (tutor), 800 (teacher)</p>
              <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">Curriculum calls: 2048</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-3">
              <p className="text-[10px] text-[var(--ll-text-faint)]">Monthly Budget Cap</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">{formatUsd(data.thisMonth.budgetCapUsd)}</p>
              <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">Set via AI_BUDGET_MONTHLY_CAP_USD</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
