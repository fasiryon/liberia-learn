/**
 * app/admin/training/adoption/page.tsx  (Server Component)
 *
 * School Training Adoption Dashboard for admins.
 * Shows aggregate counts only — no teacher-level PII.
 *
 * Feature-gated: redirects to /admin when ENABLE_TRAINING_CENTER is false.
 * Auth: ADMIN role required.
 * Tenant isolation: queries scoped to admin's schoolId.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSchoolAdoptionStats } from "@/lib/training/progress";
import { MODULES_BY_LEVEL, LEVEL_LABELS } from "@/lib/training/modules";

export const dynamic = "force-dynamic";

export default async function TrainingAdoptionPage() {
  // ── Feature gate ──────────────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER !== "true") {
    redirect("/admin");
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; schoolId?: string | null } | undefined;

  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  // ── Session JWT may have stale null schoolId — handle gracefully ──────────
  const schoolId = user.schoolId ?? null;
  if (!schoolId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
          <h1 className="text-2xl font-bold">No School Assigned</h1>
          <p className="text-slate-400">
            Your admin account does not have a school attached. Attach your school first.
          </p>
          <Link href="/admin" className="inline-block rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold hover:bg-slate-700">
            ← Back to Admin
          </Link>
        </div>
      </main>
    );
  }

  // ── Adoption data ─────────────────────────────────────────────────────────
  const stats = await getSchoolAdoptionStats(schoolId);
  const { totalTeachers, level1Complete, level2Complete, level3Complete } = stats;

  const levels = [
    {
      level: 1 as const,
      count: level1Complete,
      label: LEVEL_LABELS[1],
      moduleCount: MODULES_BY_LEVEL[1].length,
      cardBorder: "border-emerald-500/30",
      cardBg: "bg-emerald-500/10",
      textColor: "text-emerald-300",
      barColor: "bg-emerald-500",
    },
    {
      level: 2 as const,
      count: level2Complete,
      label: LEVEL_LABELS[2],
      moduleCount: MODULES_BY_LEVEL[2].length,
      cardBorder: "border-blue-500/30",
      cardBg: "bg-blue-500/10",
      textColor: "text-blue-300",
      barColor: "bg-blue-500",
    },
    {
      level: 3 as const,
      count: level3Complete,
      label: LEVEL_LABELS[3],
      moduleCount: MODULES_BY_LEVEL[3].length,
      cardBorder: "border-purple-500/30",
      cardBg: "bg-purple-500/10",
      textColor: "text-purple-300",
      barColor: "bg-purple-500",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-emerald-300">
              LIBERIALEARN · ADMIN · TRAINING
            </p>
            <h1 className="text-2xl font-bold md:text-3xl">Training Adoption</h1>
            <p className="mt-1 text-sm text-slate-400">
              School-wide teacher training progress. Counts only — no individual teacher data.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold hover:bg-slate-900 transition-colors"
          >
            ← Back
          </Link>
        </header>

        {/* ── Total teachers ─────────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="mb-1 text-sm text-slate-400">Total Teachers</p>
          <p className="text-5xl font-bold text-white">{totalTeachers}</p>
          <p className="mt-2 text-sm text-slate-500">
            Teachers enrolled at this school
          </p>
        </section>

        {/* ── Level completion grid ──────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Level Completion</h2>

          {totalTeachers === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 text-center text-sm text-slate-400">
              No teachers found for this school yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {levels.map(({ level, count, label, cardBorder, cardBg, textColor, barColor }) => {
                const pct = totalTeachers > 0 ? Math.round((count / totalTeachers) * 100) : 0;
                return (
                  <div
                    key={level}
                    className={`rounded-2xl border p-6 ${cardBorder} ${cardBg}`}
                  >
                    <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${textColor}`}>
                      {label}
                    </p>
                    <p className={`text-4xl font-bold ${textColor}`}>{count}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {pct}% of teachers
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {count} of {totalTeachers} completed all modules
                    </p>
                    <div className="mt-4 h-2 rounded-full bg-slate-800/60">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Tip ────────────────────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-slate-300">Tip:</span> Share the Training Center
            link with teachers so they can complete modules at their own pace.
            Each module takes 5–7 minutes and can be done on a phone.
          </p>
        </div>
      </div>
    </main>
  );
}
