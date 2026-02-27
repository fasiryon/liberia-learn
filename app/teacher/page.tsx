// app/teacher/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { computeEarnedBadges } from "@/lib/training/badges";
import type { ModuleProgressRecord } from "@/lib/training/progress";
import { DemoHintsSection } from "@/components/DemoHintsSection";

export const dynamic = "force-dynamic";

const TRAINING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER === "true";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    name?: string | null;
    email?: string | null;
  };
};

export default async function TeacherDashboardPage() {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const teacherId = session.user.id as string;

  const classes = await prisma.class.findMany({
    where: { teacherId },
    include: {
      School: true,
      enrollments: true,
      homework: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const primaryClass = classes[0] || null;
  const schoolName =
    primaryClass?.School?.name || "Your LiberiaLearn Partner School";

  const totalStudents = classes.reduce(
    (sum, cls) => sum + cls.enrollments.length,
    0
  );

  const totalHomework = classes.reduce(
    (sum, cls) => sum + cls.homework.length,
    0
  );

  // ── Training badges (only query if flag is on) ────────────────────────────
  let trainingBadges: ReturnType<typeof computeEarnedBadges> = [];
  let trainingCompleted = 0;
  if (TRAINING_ENABLED) {
    const rawProgress = await prisma.trainingProgress.findMany({
      where: { teacherUserId: teacherId },
      select: { moduleId: true, status: true, startedAt: true, completedAt: true },
    });
    const progressRecords: ModuleProgressRecord[] = rawProgress.map((r) => ({
      moduleId: r.moduleId,
      status: r.status as "not_started" | "in_progress" | "complete",
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }));
    trainingBadges = computeEarnedBadges(progressRecords);
    trainingCompleted = progressRecords.filter((p) => p.status === "complete").length;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ── Top header ──────────────────────────────────────────────── */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300 mb-1">
              LIBERIALEARN · TEACHER
            </p>
            <h1 className="text-2xl md:text-3xl font-bold">
              {session.user.name || "Sample Teacher"}{" "}
              <span className="text-slate-400 font-normal">
                @ {schoolName}
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage your classes, homework, and student performance.
            </p>
          </div>

          {/* Header buttons — increased padding (py-2.5 → was py-2, text-sm → was text-xs) */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-5 py-2.5 text-sm hover:bg-slate-900 transition-colors"
            >
              ← Home
            </Link>

            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-red-400 transition-colors"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <DemoHintsSection variant="teacher" />

        {/* ── Nav tabs — enlarged tap targets ─────────────────────────── */}
        <nav className="mb-8 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          <Link
            href="/teacher"
            className="rounded-full bg-slate-100 text-slate-900 px-5 py-2 text-sm font-semibold"
          >
            Overview
          </Link>
          <Link
            href="/teacher/homework"
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
          >
            Homework
          </Link>
          <Link
            href="/teacher/curriculum"
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
          >
            Curriculum
          </Link>
          {TRAINING_ENABLED && (
            <Link
              href="/teacher/training"
              className="rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              🎓 Training
            </Link>
          )}
        </nav>

        {/* ── Overview stats — more padding, larger figures ────────────── */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400 mb-1">Classes you teach</p>
            <p className="text-3xl font-bold text-slate-50">{classes.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400 mb-1">Total students</p>
            <p className="text-3xl font-bold text-slate-50">{totalStudents}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400 mb-1">Homework assignments</p>
            <p className="text-3xl font-bold text-slate-50">{totalHomework}</p>
          </div>
        </section>

        {/* ── Training Center card (when flag is on) ────────────────────── */}
        {TRAINING_ENABLED && (
          <section className="mb-8">
            <Link
              href="/teacher/training"
              className="block rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 hover:bg-emerald-500/15 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">🎓</span>
                    <h2 className="text-lg font-bold text-emerald-300">Training Center</h2>
                  </div>
                  <p className="text-sm text-slate-400">
                    Short lessons to help you use LiberiaLearn with confidence.
                    Each module takes 5–7 minutes and can be done on your phone.
                  </p>

                  {/* Badges earned (small) */}
                  {trainingBadges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trainingBadges.map((b) => (
                        <span
                          key={b.name}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300"
                        >
                          {b.emoji} {b.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {trainingCompleted > 0 && trainingBadges.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      {trainingCompleted} module{trainingCompleted !== 1 ? "s" : ""} completed
                    </p>
                  )}
                </div>
                <span className="mt-1 text-slate-400 text-sm font-semibold shrink-0">
                  Open →
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* ── Classes list ─────────────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Classes at {schoolName}
          </h2>

          {classes.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 text-center text-sm text-slate-400">
              No classes found yet. Create classes in the admin console or seed
              the database.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold">{cls.name}</h3>
                      <span className="rounded-full bg-blue-500/20 text-blue-200 text-xs px-3 py-1.5">
                        {cls.enrollments.length} students
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-1">
                      {cls.subject} · {cls.School?.name || schoolName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Gradebook & detailed analytics coming — homework and
                      student list are live now.
                    </p>
                  </div>

                  {/* Primary actions — larger buttons (py-3 px-5 text-sm → was py-2 px-4 text-xs) */}
                  <div className="mt-5 flex gap-3">
                    <Link
                      href={`/teacher/homework?classId=${cls.id}`}
                      className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      Homework
                    </Link>
                    <Link
                      href={`/teacher/class/${cls.id}/students`}
                      className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      View students
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Resources — collapsed by default (advanced / secondary) ─── */}
        <CollapsiblePanel title="Resources &amp; quick links" defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <span>🏫</span>
              <span>Admin console</span>
            </Link>
            <Link
              href="/teacher/attendance"
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <span>📋</span>
              <span>Attendance</span>
            </Link>
            <Link
              href="/teacher/schedule"
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <span>📅</span>
              <span>Schedule</span>
            </Link>
            <Link
              href="/teacher/students"
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <span>👥</span>
              <span>All students</span>
            </Link>
          </div>
        </CollapsiblePanel>
      </div>
    </main>
  );
}
