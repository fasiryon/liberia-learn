import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
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
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) redirect("/");

  const isPlatformAdmin = user.isPlatformAdmin === true;
  const schoolId = user.schoolId as string | null;
  const circuitOpen = isGovCircuitBreakerTripped();
  const exportsEnabled = !circuitOpen && isGovExportsEnabled();
  const nationalEnabled = exportsEnabled && isPlatformAdmin && isGovNationalExportEnabled();
  const yearMonth = currentYearMonth();

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

  const schoolScope = schoolId ? `?scope=school&scopeId=${schoolId}` : "";
  const downloads = [
    {
      title: "School Progress Report",
      description:
        "Shows how many students, teachers, and classes are active, and how much homework has been completed.",
      csvUrl: `/api/admin/governance/exports/student-performance${schoolScope}&format=csv`,
      jsonUrl: `/api/admin/governance/exports/student-performance${schoolScope}&format=json`,
      icon: "SP",
      color: "bg-[var(--ll-yellow-soft)]",
    },
    {
      title: "Class Summary",
      description:
        "Shows the number of classes in your school and the average number of students per class.",
      csvUrl: `/api/admin/governance/exports/class-summary${schoolScope}&format=csv`,
      jsonUrl: `/api/admin/governance/exports/class-summary${schoolScope}&format=json`,
      icon: "CS",
      color: "bg-[var(--ll-silver-soft)]",
    },
    {
      title: `This Month's Report (${yearMonth})`,
      description:
        "A full summary for this month: student activity, SMS messages, training completions, and more.",
      csvUrl: `/api/admin/governance/exports/monthly-report${schoolScope}&yearMonth=${yearMonth}&format=csv`,
      jsonUrl: `/api/admin/governance/exports/monthly-report${schoolScope}&yearMonth=${yearMonth}&format=json`,
      icon: "MR",
      color: "bg-violet-600",
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs hover:bg-[var(--ll-bg)] focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Back to Admin Console"
          >
            Back
          </Link>
          <div>
            <p className="mb-0.5 text-xs uppercase tracking-wide text-[var(--ll-yellow)]">Governance</p>
            <h1 className="text-2xl font-bold">Data Downloads</h1>
            <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">
              Download safe reports for your school. No student names are included -
              only totals and percentages.
            </p>
          </div>
        </header>

        {circuitOpen ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-300"
          >
            Data downloads are temporarily disabled by the system administrator.
            Please try again later or contact support.
          </div>
        ) : null}

        <section className="mb-8 space-y-4">
          {downloads.map((download) => (
            <div
              key={download.title}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${download.color} text-sm font-bold`}
                  aria-hidden="true"
                >
                  {download.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="mb-1 text-base font-semibold">{download.title}</h2>
                  <p className="mb-4 text-sm text-[var(--ll-text-muted)]">{download.description}</p>
                  {exportsEnabled ? (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={download.csvUrl}
                        className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow)] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        Spreadsheet (CSV)
                      </a>
                      <a
                        href={download.jsonUrl}
                        className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)] focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        JSON
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs italic text-[var(--ll-text-faint)]">Downloads are currently disabled.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {isPlatformAdmin ? (
          <section className="mb-8 rounded-xl border border-amber-800/40 bg-[var(--ll-yellow-soft)] p-5">
            <h2 className="mb-2 text-base font-semibold text-[var(--ll-yellow)]">
              National Aggregates (Platform Admin)
            </h2>
            <p className="mb-4 text-sm text-[var(--ll-text-muted)]">
              Download summary data across all schools. These exports are logged and audited.
            </p>
            {nationalEnabled ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/admin/governance/exports/student-performance?scope=national&format=csv"
                  className="rounded-xl border border-amber-700 px-4 py-2 text-sm font-semibold text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow-soft)] focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  National Performance (CSV)
                </a>
                <a
                  href={`/api/admin/governance/exports/monthly-report?scope=national&yearMonth=${yearMonth}&format=csv`}
                  className="rounded-xl border border-amber-700 px-4 py-2 text-sm font-semibold text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow-soft)] focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  National Monthly Report (CSV)
                </a>
              </div>
            ) : (
              <p className="text-xs italic text-[var(--ll-text-faint)]">
                National exports are currently disabled.
              </p>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-base font-semibold">Recent Downloads</h2>
          <p className="mb-3 text-xs text-[var(--ll-text-muted)]">Your last 5 downloads are listed below.</p>
          {recentExports.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-faint)]">No downloads yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentExports.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-2.5 text-xs"
                >
                  <span className="whitespace-nowrap text-[var(--ll-text-muted)]">
                    {new Date(record.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="font-medium text-[var(--ll-text)]">
                    {record.exportType.replace(/_/g, " ")}
                  </span>
                  <span className="ml-auto uppercase text-[var(--ll-text-faint)]">
                    {record.format ?? "-"} | {record.scope}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-4">
            <Link
              href="/admin/compliance"
              className="text-xs text-[var(--ll-yellow)] hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
            >
              View full audit log
            </Link>
            {isPlatformAdmin ? (
              <Link
                href="/admin/governance"
                className="text-xs text-[var(--ll-yellow)] hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
              >
                View governance dashboard
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
