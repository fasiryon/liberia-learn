// app/teacher/page.tsx
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Top header */}
        <header className="mb-6 flex items-center justify-between gap-4">
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

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs md:text-sm hover:bg-slate-900"
            >
              ← Student demo / Login
            </Link>

            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full bg-red-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-red-400"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        {/* Simple nav tabs (both real links) */}
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <Link
            href="/teacher"
            className="rounded-full bg-slate-100 text-slate-900 px-4 py-1 text-xs font-semibold"
          >
            Overview
          </Link>
          <Link
            href="/teacher/homework"
            className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800"
          >
            Homework
          </Link>
        </nav>

        {/* Overview stats */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400 mb-1">Classes you teach</p>
            <p className="text-2xl font-bold text-slate-50">
              {classes.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400 mb-1">Total students</p>
            <p className="text-2xl font-bold text-slate-50">{totalStudents}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400 mb-1">
              Homework assignments
            </p>
            <p className="text-2xl font-bold text-slate-50">
              {totalHomework}
            </p>
          </div>
        </section>

        {/* Classes list */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
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
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold">
                        {cls.name}
                      </h3>
                      <span className="rounded-full bg-blue-500/20 text-blue-200 text-xs px-3 py-1">
                        {cls.enrollments.length} students
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">
                      {cls.subject} · {cls.School?.name || schoolName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Gradebook & detailed analytics coming – homework and
                      student list are live now.
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/teacher/homework?classId=${cls.id}`}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                    >
                      Homework
                    </Link>
                    <Link
                      href={`/teacher/class/${cls.id}/students`}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      View students
                    </Link>
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
