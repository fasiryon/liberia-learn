/**
 * app/teacher/training/page.tsx  (Server Component)
 *
 * Training Center landing page.
 * Shows Levels 1–3 with per-module status, progress bars, and earned badges.
 *
 * Feature-gated: redirects to /teacher when ENABLE_TRAINING_CENTER is false.
 * Auth: TEACHER or ADMIN only.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TRAINING_MODULES, MODULES_BY_LEVEL, LEVEL_LABELS } from "@/lib/training/modules";
import { computeEarnedBadges } from "@/lib/training/badges";
import type { ModuleProgressRecord } from "@/lib/training/progress";

export const dynamic = "force-dynamic";

export default async function TrainingCenterPage() {
  // ── Feature gate ──────────────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER !== "true") {
    redirect("/teacher");
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; name?: string | null } | undefined;

  if (!user?.id) redirect("/login");
  if (user.role !== "TEACHER" && user.role !== "ADMIN") redirect("/");

  // ── Progress data ─────────────────────────────────────────────────────────
  const rawProgress = await prisma.trainingProgress.findMany({
    where: { teacherUserId: user.id },
    select: { moduleId: true, status: true, startedAt: true, completedAt: true },
  });

  const progressRecords: ModuleProgressRecord[] = rawProgress.map((r) => ({
    moduleId: r.moduleId,
    status: r.status as "not_started" | "in_progress" | "complete",
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));

  const progressMap = new Map(progressRecords.map((p) => [p.moduleId, p.status]));
  const badges = computeEarnedBadges(progressRecords);

  const totalModules = TRAINING_MODULES.length;
  const completedCount = progressRecords.filter((p) => p.status === "complete").length;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#10b98122,_transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[var(--ll-yellow)]">
              LIBERIALEARN · TRAINING CENTER
            </p>
            <h1 className="text-2xl font-bold md:text-3xl">Your Training</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Short lessons to help you use LiberiaLearn with confidence.
            </p>
          </div>
          <Link
            href="/teacher"
            className="rounded-full border border-[var(--ll-border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--ll-bg)] transition-colors"
          >
            ← Back
          </Link>
        </header>

        {/* ── Overall progress ───────────────────────────────────────────── */}
        <section className="mb-8 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--ll-text)]">Overall progress</p>
            <p className="text-sm text-[var(--ll-text-muted)]">
              {completedCount} / {totalModules} modules complete
            </p>
          </div>
          <div className="h-3 rounded-full bg-[var(--ll-surface)]">
            <div
              className="h-3 rounded-full bg-[var(--ll-yellow)] transition-all duration-500"
              style={{ width: totalModules > 0 ? `${(completedCount / totalModules) * 100}%` : "0%" }}
            />
          </div>
        </section>

        {/* ── Earned badges ──────────────────────────────────────────────── */}
        {badges.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
              Your Badges
            </h2>
            <div className="flex flex-wrap gap-3">
              {badges.map((b) => (
                <span
                  key={b.name}
                  className="rounded-full border border-emerald-500/30 bg-[var(--ll-yellow)]/10 px-4 py-2 text-sm font-semibold text-[var(--ll-yellow)]"
                >
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Level sections ─────────────────────────────────────────────── */}
        <div className="space-y-10">
          {([1, 2, 3] as const).map((level) => {
            const modules = MODULES_BY_LEVEL[level];
            const done = modules.filter((m) => progressMap.get(m.id) === "complete").length;
            const levelDone = done === modules.length;

            const levelBorderColor =
              level === 1
                ? "border-emerald-500/40"
                : level === 2
                ? "border-blue-500/40"
                : "border-purple-500/40";

            const progressBarColor =
              level === 1 ? "bg-[var(--ll-yellow)]" : level === 2 ? "bg-[var(--ll-silver-soft)]" : "bg-[var(--ll-pink-soft)]";

            return (
              <section key={level}>
                {/* Level header */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">{LEVEL_LABELS[level]}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--ll-text-muted)]">
                      {done}/{modules.length} complete
                    </span>
                    {levelDone && (
                      <span className="rounded-full bg-[var(--ll-yellow)]/20 px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]">
                        ✓ Certified
                      </span>
                    )}
                  </div>
                </div>

                {/* Level progress bar */}
                <div className="mb-5 h-2 rounded-full bg-[var(--ll-surface)]">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${progressBarColor}`}
                    style={{ width: modules.length > 0 ? `${(done / modules.length) * 100}%` : "0%" }}
                  />
                </div>

                {/* Module cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {modules.map((mod) => {
                    const status = progressMap.get(mod.id) ?? "not_started";
                    const isComplete = status === "complete";
                    const isInProgress = status === "in_progress";

                    const cardClass = isComplete
                      ? "border-emerald-500/30 bg-[var(--ll-yellow)]/10"
                      : isInProgress
                      ? "border-blue-500/30 bg-[var(--ll-silver-soft)]"
                      : `border-[var(--ll-border)] bg-[var(--ll-bg)]/80 hover:border-[var(--ll-border)] ${levelBorderColor}`;

                    const statusLabel = isComplete
                      ? "Complete ✅"
                      : isInProgress
                      ? "In progress 🔄"
                      : "Not started 📖";

                    return (
                      <Link
                        key={mod.id}
                        href={`/teacher/training/${mod.id}`}
                        className={`block rounded-xl border p-5 transition-all hover:opacity-90 ${cardClass}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-semibold leading-snug">{mod.title}</h3>
                        </div>
                        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">~{mod.estimatedMinutes} min</p>
                        <p className="mt-3 text-xs font-medium text-[var(--ll-text-faint)]">{statusLabel}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
