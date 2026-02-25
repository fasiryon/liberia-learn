/**
 * /admin/governance/exports — Data Downloads
 *
 * Server component. Provides three download buttons for MOE governance exports.
 * Plain-language UI for low-literacy admins.
 * All links are keyboard-accessible.
 * Escape hatch: ← Back to Admin Console.
 *
 * Exports are served by:
 *   - /api/admin/governance/exports/student-performance
 *   - /api/admin/governance/exports/class-summary
 *   - /api/admin/governance/exports/monthly-report
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isGovExportsEnabled,
  isGovCircuitBreakerTripped,
  isGovNationalExportEnabled,
} from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function GovernanceExportsPage() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const isPlatformAdmin = user.isPlatformAdmin === true;
  const schoolId = user.schoolId as string | null;

  // ── Feature flags ─────────────────────────────────────────────────────────
  const circuitOpen = isGovCircuitBreakerTripped();
  const exportsEnabled = !circuitOpen && isGovExportsEnabled();
  const nationalEnabled = exportsEnabled && isPlatformAdmin && isGovNationalExportEnabled();

  const yearMonth = currentYearMonth();

  // ── Recent export history ─────────────────────────────────────────────────
  const recentExports = await prisma.exportRecord.findMany({
    where: {
      exportType: { in: ["student_performance", "class_summary", "monthly_report"] },
      ...(schoolId && !isPlatformAdmin ? { scopeId: schoolId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      exportType: true,
      scope: true,
      format: true,
    },
  });

  // ── Build download URLs ───────────────────────────────────────────────────
  const schoolScope = schoolId ? `?scope=school&scopeId=${schoolId}` : "";

  const downloads = [
    {
      title: "School Progress Report",
      description:
        "Shows how many students, teachers, and classes are active, and how much homework has been completed.",
      csvUrl: `/api/admin/governance/exports/student-performance${schoolScope}&format=csv`,
      jsonUrl: `/api/admin/governance/exports/student-performance${schoolScope}&format=json`,
      icon: "📊",
      color: "bg-emerald-600",
    },
    {
      title: "Class Summary",
      description:
        "Shows the number of classes in your school and the average number of students per class.",
      csvUrl: `/api/admin/governance/exports/class-summary${schoolScope}&format=csv`,
      jsonUrl: `/api/admin/governance/exports/class-summary${schoolScope}&format=json`,
      icon: "🏫",
      color: "bg-blue-600",
    },
    {
      title: `This Month's Report (${yearMonth})`,
      description:
        "A full summary for this month: student activity, SMS messages, training completions, and more.",
      csvUrl: `/api/admin/governance/exports/monthly-report${schoolScope}&yearMonth=${yearMonth}&format=csv`,
      jsonUrl: `/api/admin/governance/exports/monthly-report${schoolScope}&yearMonth=${yearMonth}&format=json`,
      icon: "📅",
      color: "bg-violet-600",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-4xl px-4 py-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Back to Admin Console"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300 mb-0.5">
              Governance
            </p>
            <h1 className="text-2xl font-bold">Data Downloads</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Download safe reports for your school. No student names are
              included — only totals and percentages.
            </p>
          </div>
        </header>

        {/* ── Circuit breaker notice ─────────────────────────────────────── */}
        {circuitOpen && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-300"
          >
            Data downloads are temporarily disabled by the system administrator.
            Please try again later or contact support.
          </div>
        )}

        {/* ── Download cards ─────────────────────────────────────────────── */}
        <section className="mb-8 space-y-4">
          {downloads.map((d) => (
            <div
              key={d.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-12 w-12 rounded-xl ${d.color} flex items-center justify-center text-2xl flex-shrink-0`}
                  aria-hidden="true"
                >
                  {d.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold mb-1">{d.title}</h2>
                  <p className="text-sm text-slate-400 mb-4">{d.description}</p>
                  {exportsEnabled ? (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={d.csvUrl}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        aria-label={`Download ${d.title} as spreadsheet`}
                      >
                        ↓ Spreadsheet (CSV)
                      </a>
                      <a
                        href={d.jsonUrl}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                        aria-label={`Download ${d.title} as JSON`}
                      >
                        ↓ JSON
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Downloads are currently disabled.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── National export (platform admin only) ─────────────────────── */}
        {isPlatformAdmin && (
          <section className="mb-8 rounded-2xl border border-amber-800/40 bg-amber-900/10 p-5">
            <h2 className="text-base font-semibold text-amber-300 mb-2">
              National Aggregates (Platform Admin)
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Download summary data across all schools. These exports are
              logged and audited.
            </p>
            {nationalEnabled ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/admin/governance/exports/student-performance?scope=national&format=csv`}
                  className="rounded-xl border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  ↓ National Performance (CSV)
                </a>
                <a
                  href={`/api/admin/governance/exports/monthly-report?scope=national&yearMonth=${yearMonth}&format=csv`}
                  className="rounded-xl border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  ↓ National Monthly Report (CSV)
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                National exports are currently disabled.
              </p>
            )}
          </section>
        )}

        {/* ── Recent export history ──────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold mb-2">Recent Downloads</h2>
          <p className="text-xs text-slate-400 mb-3">
            Your last 5 downloads are listed below.
          </p>
          {recentExports.length === 0 ? (
            <p className="text-sm text-slate-500">No downloads yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentExports.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs"
                >
                  <span className="text-slate-400 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-slate-200 font-medium">
                    {r.exportType.replace(/_/g, " ")}
                  </span>
                  <span className="ml-auto text-slate-500 uppercase">
                    {r.format ?? "—"} · {r.scope}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link
              href="/admin/compliance"
              className="text-xs text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
            >
              View full audit log →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
