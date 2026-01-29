// app/assignments/page.tsx
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

export default async function StudentAssignmentsPage() {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const userId = session.user.id as string;

  // Get student first to know studentId
  const student = await prisma.student.findFirst({
    where: { userId },
    include: { user: true },
  });

  if (!student) {
    redirect("/dashboard");
  }

  // Get all classes the student is enrolled in + homework + their submissions
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    include: {
      Class: {
        include: {
          School: true,
          homework: {
            include: {
              submissions: {
                where: { studentId: student.id },
              },
            },
          },
        },
      },
    },
  });

  const homeworkItems = enrollments
    .flatMap((enr) =>
      enr.Class.homework.map((hw) => {
        const submission = hw.submissions[0] || null;
        return {
          id: hw.id,
          title: hw.title,
          instructions: hw.instructions,
          dueAt: hw.dueAt,
          className: enr.Class.name,
          schoolName: enr.Class.School?.name ?? "School",
          submitted: !!submission,
          score: submission?.teacherScore ?? submission?.aiScore ?? null,
        };
      })
    )
    .sort((a, b) => {
      const t1 = a.dueAt ? new Date(a.dueAt).getTime() : 0;
      const t2 = b.dueAt ? new Date(b.dueAt).getTime() : 0;
      return t1 - t2;
    });

  const studentName = student.user?.name || "Student";
  const location =
    student.community && student.county
      ? `${student.community}, ${student.county}`
      : student.county || "Montserrado";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300">
              LIBERIALEARN
            </p>
            <h1 className="text-2xl font-semibold">
              Homework &amp; assignments
            </h1>
            <p className="text-xs text-slate-400">
              {studentName} · {location}
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:bg-slate-900"
          >
            ← Back to dashboard
          </Link>
        </header>

        {homeworkItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-400">
            No homework yet. Your teachers will assign work here.
          </div>
        ) : (
          <div className="space-y-3">
            {homeworkItems.map((hw) => (
              <Link
                key={hw.id}
                href={`/assignments/${hw.id}`}
                className="block rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 hover:border-emerald-500/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {hw.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {hw.className} · {hw.schoolName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Due:{" "}
                      {hw.dueAt
                        ? new Date(hw.dueAt).toLocaleDateString()
                        : "No due date"}
                    </p>
                  </div>

                  <div className="text-right text-xs">
                    {hw.submitted ? (
                      <div>
                        <p className="text-emerald-400 font-semibold">
                          Submitted
                        </p>
                        {hw.score != null && (
                          <p className="text-emerald-300">
                            Score: {hw.score}%
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-amber-300 font-semibold">
                        Not submitted
                      </p>
                    )}
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
