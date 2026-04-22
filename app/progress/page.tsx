// app/progress/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    email?: string | null;
    name?: string | null;
  };
};

export default async function ProgressPage() {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");

  const role = session.user.role;
  const userId = session.user.id as string;

  if (role === "TEACHER") redirect("/teacher");
  if (role === "ADMIN") redirect("/admin");

  const student = await prisma.student.findFirst({
    where: { userId },
    include: {
      user: true,
      grades: {
        include: { Class: true },
        orderBy: { computedAt: "desc" },
      },
      homeworkSubmissions: {
        include: {
          Homework: {
            include: {
              Class: true,
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!student) {
    redirect("/");
  }

  const overallAvg =
    student.grades.length > 0
      ? (
          student.grades.reduce((sum, g) => sum + g.percent, 0) /
          student.grades.length
        ).toFixed(1)
      : null;

  // Average per class
  const byClass = new Map<
    string,
    { name: string; percentSum: number; count: number }
  >();

  for (const g of student.grades) {
    const key = g.classId;
    if (!byClass.has(key)) {
      byClass.set(key, {
        name: g.Class?.name || "Class",
        percentSum: 0,
        count: 0,
      });
    }
    const entry = byClass.get(key)!;
    entry.percentSum += g.percent;
    entry.count += 1;
  }

  const classAverages = Array.from(byClass.entries()).map(
    ([classId, data]) => ({
      classId,
      name: data.name,
      avg: data.count > 0 ? data.percentSum / data.count : 0,
      count: data.count,
    })
  );

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-yellow)]">
              LiberiaLearn
            </p>
            <h1 className="text-2xl font-semibold">Progress & reports</h1>
            <p className="text-xs text-[var(--ll-text-muted)]">
              See your grades and homework history across all classes.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text)] hover:bg-[var(--ll-bg)]"
          >
            ← Back to dashboard
          </Link>
        </header>

        {/* Summary */}
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-xs text-[var(--ll-text-muted)] mb-1">Overall average</p>
            <p className="text-2xl font-semibold text-[var(--ll-yellow)]">
              {overallAvg ? `${overallAvg}%` : "—"}
            </p>
            <p className="text-[11px] text-[var(--ll-text-faint)]">
              {student.grades.length} graded items
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-xs text-[var(--ll-text-muted)] mb-1">Classes with grades</p>
            <p className="text-2xl font-semibold text-[var(--ll-text)]">
              {classAverages.length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-xs text-[var(--ll-text-muted)] mb-1">Homework submissions</p>
            <p className="text-2xl font-semibold text-[var(--ll-text)]">
              {student.homeworkSubmissions.length}
            </p>
          </div>
        </section>

        {/* Per-class averages */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-3">
            By class
          </p>

          {classAverages.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-faint)]">
              No graded work yet. Once your teacher grades assignments, they
              will appear here.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {classAverages.map((c) => (
                <div
                  key={c.classId}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-[var(--ll-text)]">{c.name}</p>
                    <p className="text-[11px] text-[var(--ll-text-muted)]">
                      {c.count} graded items
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[var(--ll-yellow)]">
                    {c.avg.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent homework history */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-3">
            Recent homework history
          </p>

          {student.homeworkSubmissions.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-faint)]">
              No homework submissions yet.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {student.homeworkSubmissions.slice(0, 10).map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-[var(--ll-text)]">
                      {sub.Homework.title}
                    </p>
                    <p className="text-[11px] text-[var(--ll-text-muted)]">
                      {sub.Homework.Class.name} ·{" "}
                      {new Date(sub.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[var(--ll-text-muted)]">Score</p>
                    <p className="text-lg font-semibold text-[var(--ll-yellow)]">
                      {sub.teacherScore !== null
                        ? `${sub.teacherScore}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
