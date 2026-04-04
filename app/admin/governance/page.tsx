import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { buildGovernanceReport, type GovernanceReportPeriod } from "@/lib/governance/report";

export const dynamic = "force-dynamic";

const PERIODS: GovernanceReportPeriod[] = ["7d", "30d", "90d"];

type PageProps = {
  searchParams?: {
    period?: string;
  };
};

function parsePeriod(value?: string): GovernanceReportPeriod {
  return value === "7d" || value === "30d" || value === "90d" ? value : "30d";
}

export default async function GovernancePage({ searchParams = {} }: PageProps) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  if (!user.isPlatformAdmin && user.role !== "MOE_OFFICIAL") {
    redirect("/");
  }

  const period = parsePeriod(searchParams.period);
  const report = await buildGovernanceReport({ viewer: user, period });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e1a,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-emerald-300">Governance</p>
            <h1 className="text-2xl font-bold">Governance Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              Export activity, audit activity, AI usage, and sensitive admin actions for the last{" "}
              {period}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((option) => (
              <Link
                key={option}
                href={`/admin/governance?period=${option}`}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  option === period
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-700 text-slate-300 hover:bg-slate-900"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">Audit Events</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">
              {report.overview.auditEvents.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">Exports</p>
            <p className="mt-2 text-2xl font-bold text-cyan-300">
              {report.overview.exportsGenerated.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">AI Actions</p>
            <p className="mt-2 text-2xl font-bold text-violet-300">
              {report.overview.aiActions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">Sensitive Actions</p>
            <p className="mt-2 text-2xl font-bold text-amber-300">
              {report.overview.sensitiveActions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">Active Admins</p>
            <p className="mt-2 text-2xl font-bold text-slate-100">
              {report.overview.activeAdmins.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">Affected Schools</p>
            <p className="mt-2 text-2xl font-bold text-fuchsia-300">
              {report.overview.affectedSchools.toLocaleString()}
            </p>
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Admin Actions</h2>
              <Link href="/admin/compliance" className="text-xs text-emerald-300 hover:underline">
                Full audit log
              </Link>
            </div>
            {report.adminActions.byAction.length === 0 ? (
              <p className="text-sm text-slate-400">No admin actions recorded in this period.</p>
            ) : (
              <div className="space-y-2">
                {report.adminActions.byAction.slice(0, 10).map((action) => (
                  <div
                    key={action.action}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{action.action}</p>
                      <p className="text-xs text-slate-500">
                        {action.sensitive ? "Sensitive" : "Standard"} governance action
                      </p>
                    </div>
                    <p className="text-lg font-bold text-slate-100">{action.count}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Export Activity</h2>
              <Link
                href="/admin/governance/exports"
                className="text-xs text-emerald-300 hover:underline"
              >
                Data downloads
              </Link>
            </div>
            {report.exportActivity.byType.length === 0 ? (
              <p className="text-sm text-slate-400">No exports generated in this period.</p>
            ) : (
              <div className="space-y-2">
                {report.exportActivity.byType.map((entry) => (
                  <div
                    key={entry.exportType}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-100">{entry.exportType}</p>
                    <p className="text-lg font-bold text-cyan-300">{entry.count}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1fr,1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="mb-4 text-lg font-semibold">AI Actions</h2>
            {report.aiActions.byFeature.length === 0 ? (
              <p className="text-sm text-slate-400">No AI actions recorded in this period.</p>
            ) : (
              <div className="space-y-2">
                {report.aiActions.byFeature.slice(0, 8).map((entry) => (
                  <div
                    key={entry.feature}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-100">{entry.feature}</p>
                      <p className="text-sm font-bold text-violet-300">{entry.count}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Cost ${entry.estimatedCostUsd.toFixed(2)} | Fallback {entry.fallbackRatePct}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="mb-4 text-lg font-semibold">Sensitive Action Log</h2>
            {report.sensitiveActionLog.length === 0 ? (
              <p className="text-sm text-slate-400">No sensitive actions recorded in this period.</p>
            ) : (
              <div className="space-y-2">
                {report.sensitiveActionLog.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{entry.action}</p>
                        <p className="text-xs text-slate-500">
                          {entry.user?.email ?? "Unknown actor"} | {entry.user?.role ?? "Unknown role"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(entry.createdAt).toLocaleString("en-GB")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
