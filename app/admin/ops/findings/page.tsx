/**
 * /admin/ops/findings
 *
 * Admin findings list — shows all OpsFinding rows for this school.
 * Filters: severity | category | status (via URL search params).
 * Escape hatch: ← Back to Admin Console link.
 * Keyboard-navigable: all links and buttons have clear focus styles.
 *
 * Server component — data fetched at render time.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RunEngineButton } from "./RunEngineButton";

export const dynamic = "force-dynamic";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-red-500    bg-red-500/10    text-red-300",
  warn:     "border-amber-500  bg-amber-500/10  text-amber-300",
  info:     "border-blue-500   bg-blue-500/10   text-blue-300",
};

const STATUS_COLORS: Record<string, string> = {
  open:     "bg-slate-700 text-slate-200",
  ack:      "bg-amber-900 text-amber-200",
  resolved: "bg-emerald-900 text-emerald-200",
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warn: 1, info: 2 };

type SearchParams = { severity?: string; category?: string; status?: string };

export default async function FindingsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  let schoolId = user.schoolId as string | null;
  if (!schoolId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { schoolId: true },
    });
    schoolId = dbUser?.schoolId ?? null;
  }

  const { severity, category, status } = searchParams;

  const findings = await prisma.opsFinding.findMany({
    where: {
      ...(user.isPlatformAdmin && !schoolId ? {} : { schoolId: schoolId ?? undefined }),
      ...(severity ? { severity } : {}),
      ...(category ? { category } : {}),
      ...(status   ? { status }   : {}),
    },
    include: { explanation: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Sort by severity (critical first)
  const sorted = [...findings].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
  );

  const openCount     = findings.filter((f) => f.status === "open").length;
  const criticalCount = findings.filter((f) => f.severity === "critical").length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6">

        {/* Header + escape hatch */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-slate-200 mb-2 inline-block focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
              aria-label="Back to Admin Console"
            >
              ← Back to Admin Console
            </Link>
            <h1 className="text-2xl font-bold">Ops Findings</h1>
            <p className="text-sm text-slate-400 mt-1">
              Deterministic signals from the self-healing ops engine.
              All recommendations are advisory only — no automatic changes are applied.
            </p>
          </div>
          <RunEngineButton schoolId={schoolId} />
        </header>

        {/* Summary chips */}
        <div className="mb-5 flex flex-wrap gap-3">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
            {findings.length} total
          </span>
          {openCount > 0 && (
            <span className="rounded-full bg-amber-900/60 border border-amber-700 px-3 py-1 text-xs text-amber-200">
              {openCount} open
            </span>
          )}
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-900/60 border border-red-700 px-3 py-1 text-xs text-red-200">
              {criticalCount} critical
            </span>
          )}
        </div>

        {/* Filters */}
        <nav
          aria-label="Filter findings"
          className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3"
        >
          {/* Severity filters */}
          {["", "critical", "warn", "info"].map((s) => (
            <Link
              key={`sev-${s || "all"}`}
              href={s ? `?severity=${s}${category ? `&category=${category}` : ""}${status ? `&status=${status}` : ""}` : "/admin/ops/findings"}
              className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                severity === s || (!severity && !s)
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All severities"}
            </Link>
          ))}
          <span className="border-l border-slate-700 mx-1" />
          {["", "open", "ack", "resolved"].map((st) => (
            <Link
              key={`st-${st || "all"}`}
              href={st ? `?status=${st}${severity ? `&severity=${severity}` : ""}` : "/admin/ops/findings"}
              className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                status === st || (!status && !st)
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {st ? st.charAt(0).toUpperCase() + st.slice(1) : "All statuses"}
            </Link>
          ))}
        </nav>

        {/* Findings list */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
            <p className="text-slate-400 text-sm">
              No findings match the current filters.
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Run the engine to detect new signals, or clear the filters above.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" role="list">
            {sorted.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/admin/ops/findings/${f.id}`}
                  className={`flex items-start gap-4 rounded-2xl border p-4 hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    SEVERITY_COLORS[f.severity] ?? "border-slate-700 bg-slate-900/60"
                  }`}
                  aria-label={`View finding: ${f.signalKey} — ${f.severity}`}
                >
                  {/* Severity indicator */}
                  <div className="mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        f.severity === "critical" ? "#ef4444"
                        : f.severity === "warn"   ? "#f59e0b"
                        :                           "#3b82f6",
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-semibold">{f.signalKey}</code>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[f.status] ?? "bg-slate-700"}`}>
                        {f.status}
                      </span>
                      <span className="text-xs text-slate-500">{f.category}</span>
                      {f.explanation && (
                        <span className="text-xs text-emerald-400">✦ AI explanation</span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-400">
                      {f.current != null && (
                        <span>Current: <strong className="text-slate-200">{(f.current * (f.category === "sms" || f.signalKey.includes("rate") ? 100 : 1)).toFixed(f.category === "offline" ? 0 : 1)}{f.signalKey.includes("rate") ? "%" : ""}</strong></span>
                      )}
                      {f.baseline != null && (
                        <span>Baseline: {(f.baseline * (f.signalKey.includes("rate") ? 100 : 1)).toFixed(1)}{f.signalKey.includes("rate") ? "%" : ""}</span>
                      )}
                      {f.deltaPct != null && (
                        <span className={f.deltaPct > 0 ? "text-red-300" : "text-emerald-300"}>
                          {f.deltaPct > 0 ? "+" : ""}{Math.round(f.deltaPct)}%
                        </span>
                      )}
                      <span>{f.windowHours}h window</span>
                      <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <span className="text-slate-500 text-sm flex-shrink-0">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
