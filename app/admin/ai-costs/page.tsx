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
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#0f766e22,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn AI Ops</p>
          <h1 className="text-3xl font-bold">AI Cost Guardrails</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Daily AI spend, fallback behavior, and monthly projection for governed tutor,
            teacher assist, grading, and curriculum workflows.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Monthly Budget</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-teal-400"
                style={{ width: `${Math.min(data.thisMonth.percentUsed, 100)}%` }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-slate-100">
                  {formatUsd(data.thisMonth.totalCostUsd)}
                </p>
                <p className="text-sm text-slate-400">
                  of {formatUsd(data.thisMonth.budgetCapUsd)} monthly cap
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-teal-300">
                  {data.thisMonth.percentUsed.toFixed(1)}%
                </p>
                <p className="text-sm text-slate-400">
                  Projected month end {formatUsd(data.thisMonth.projectedMonthEndUsd)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Fallback Rate Today</p>
            <p className="mt-3 text-3xl font-bold text-slate-100">
              {formatPercent(data.today.fallbackRate)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {data.today.fallbackCount} fallbacks across {data.today.requestCount} requests
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Cost today</p>
                <p className="mt-1 font-semibold text-slate-100">
                  {formatUsd(data.today.totalCostUsd)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Tokens today</p>
                <p className="mt-1 font-semibold text-slate-100">
                  {data.today.totalTokens.toLocaleString("en-US")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data.today.byFeature).map(([feature, summary]) => (
            <div key={feature} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">{feature}</p>
              <p className="mt-2 text-2xl font-bold text-slate-100">
                {formatUsd(summary.costUsd)}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {summary.requestCount} requests, {summary.fallbackCount} fallbacks
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Top Schools By Spend</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Today</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.today.topSchoolsBySpend.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {user.isPlatformAdmin
                    ? "No school spend recorded today."
                    : "School-level spend is scoped to your tenant."}
                </p>
              ) : (
                data.today.topSchoolsBySpend.map((school) => (
                  <div
                    key={school.schoolId}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-100">{school.name}</p>
                      <p className="text-xs text-slate-500">{school.schoolId}</p>
                    </div>
                    <p className="font-semibold text-teal-300">{formatUsd(school.costUsd)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Alerts</p>
            <div className="mt-4 space-y-3">
              {data.alerts.length === 0 ? (
                <p className="text-sm text-slate-400">No active budget alerts.</p>
              ) : (
                data.alerts.map((alert) => (
                  <div
                    key={alert}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
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
