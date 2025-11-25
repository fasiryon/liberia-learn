// app/teacher/class/[id]/students/page.tsx
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

export default async function ClassStudentsPage({
  params,
}: {
  params: { id: string };
}) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const teacherId = session.user.id as string;
  const classId = params.id;

  const cls = await prisma.class.findFirst({
    where: {
      id: classId,
      teacherId,
    },
    include: {
      School: true,
      enrollments: {
        include: {
          Student: {
            include: {
              user: true,
              grades: true, // we'll filter by class in code
            },
          },
        },
      },
      homework: true,
    },
  });

  if (!cls) {
    // Either class not found, or you don't teach it
    redirect("/teacher");
  }

  const students = cls.enrollments.map((enr) => {
    const s = enr.Student;
    const gradesForThisClass = s.grades.filter((g) => g.classId === cls.id);

    const avg =
      gradesForThisClass.length > 0
        ? gradesForThisClass.reduce((sum, g) => sum + g.percent, 0) /
          gradesForThisClass.length
        : null;

    const lastUpdated =
      gradesForThisClass.length > 0
        ? gradesForThisClass
            .slice()
            .sort(
              (a, b) =>
                new Date(b.computedAt).getTime() -
                new Date(a.computedAt).getTime()
            )[0].computedAt
        : null;

    return {
      id: s.id,
      name: s.user?.name || "Unnamed student",
      email: s.user?.email || "",
      county: s.county || "—",
      community: s.community || "—",
      avgGrade: avg,
      lastUpdated,
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/teacher"
              className="inline-block text-xs text-emerald-300 hover:underline mb-2"
            >
              ← Back to teacher dashboard
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold">
              {cls.name} • Students
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {cls.School?.name || "School"} · Subject: {cls.subject}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-right">
            <p className="text-slate-400">Total students</p>
            <p className="text-xl font-semibold text-emerald-300">
              {students.length}
            </p>
            <p className="text-[11px] text-slate-500">
              Homework assigned: {cls.homework.length}
            </p>
          </div>
        </header>

        {/* Students list */}
        {students.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 text-center text-sm text-slate-400">
            No students enrolled in this class yet.
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/teacher/student/${s.id}`}
                className="block rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {s.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {s.community}, {s.county}
                    </p>
                    {s.email && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        {s.email}
                      </p>
                    )}
                  </div>

                  <div className="text-right text-xs">
                    <p className="text-slate-400 mb-1">Average grade</p>
                    <p className="text-lg font-semibold text-emerald-300">
                      {s.avgGrade !== null ? `${s.avgGrade.toFixed(1)}%` : "—"}
                    </p>
                    {s.lastUpdated && (
                      <p className="text-[11px] text-slate-500">
                        Updated{" "}
                        {new Date(s.lastUpdated).toLocaleDateString()}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-emerald-300">
                      View full profile →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
