// app/teacher/student/[id]/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

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

type PageProps = {
  params: { id: string };
};

export default async function TeacherStudentProfilePage({ params }: PageProps) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "TEACHER") redirect("/");

  const teacherId = session.user.id as string;
  const studentId = params.id;

  // Load student + related data
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      enrollments: {
        include: {
          Class: {
            include: {
              School: true,
              Teacher: true,
            },
          },
        },
      },
      grades: {
        include: {
          Class: true,
        },
        orderBy: { computedAt: "desc" },
        take: 10,
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
        take: 10,
      },
      placementTests: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!student) {
    redirect("/teacher");
  }

  // Optional safety: restrict to students this teacher actually teaches
  const teachesStudent =
    student.enrollments.some(
      (enr: any) => enr.Class?.teacherId === teacherId
    ) || student.homeworkSubmissions.some(
      (s: any) => s.Homework?.classId &&
        s.Homework.Class?.teacherId === teacherId
    );

  if (!teachesStudent) {
    // For now just let them in – if you want, you can enforce:
    // redirect("/teacher");
  }

  const studentName = student.user?.name ?? "Student";
  const email = student.user?.email ?? "";
  const county = student.county ?? "Montserrado";
  const community = student.community ?? "New Kru Town";

  const avgGrade =
    student.grades.length > 0
      ? (
          student.grades.reduce(
            (sum: number, g: any) => sum + g.percent,
            0
          ) / student.grades.length
        ).toFixed(1)
      : null;

  const latestPlacement = student.placementTests[0] ?? null;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-yellow)]">
              LIBERIALEARN · Student profile
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{studentName}</h1>
            <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
              {community}, {county}
            </p>
            {email && (
              <p className="text-[11px] text-[var(--ll-text-faint)]">{email}</p>
            )}
          </div>

          <Link
            href="/teacher/class"
            className="text-xs rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-[var(--ll-text)] hover:text-[var(--ll-text)]"
          >
            ← Back to class list
          </Link>
        </div>

        {/* Top stats */}
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-1">
              Average grade
            </p>
            <p className="text-2xl font-semibold text-[var(--ll-yellow)]">
              {avgGrade ? `${avgGrade}%` : "—"}
            </p>
            <p className="text-[11px] text-[var(--ll-text-faint)]">
              {student.grades.length} grade records
            </p>
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-1">
              Current placement
            </p>
            <p className="text-2xl font-semibold">
              {student.currentGrade
                ? `Grade ${student.currentGrade}`
                : "Not set"}
            </p>
            {latestPlacement ? (
              <p className="text-[11px] text-[var(--ll-text-faint)]">
                Last test: {latestPlacement.levelLabel} · {Math.round((latestPlacement.rawScore / latestPlacement.totalQuestions) * 100)}%
              </p>
            ) : (
              <p className="text-[11px] text-[var(--ll-text-faint)]">
                No placement tests yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-1">
              Classes
            </p>
            <p className="text-2xl font-semibold text-[var(--ll-silver)]">
              {student.enrollments.length}
            </p>
            <p className="text-[11px] text-[var(--ll-text-faint)]">
              Enrolled classes this year
            </p>
          </div>
        </section>

        {/* Classes list */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
            Enrolled classes
          </p>
          {student.enrollments.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-faint)]">
              No class enrollments found.
            </p>
          ) : (
            <div className="space-y-2">
              {student.enrollments.map((enr: any) => (
                <div
                  key={enr.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 border border-[var(--ll-border)] px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-[var(--ll-text)]">
                      {enr.Class?.name}
                    </p>
                    <p className="text-[11px] text-[var(--ll-text-faint)]">
                      {enr.Class?.subject} · {enr.Class?.School?.name}
                    </p>
                  </div>
                  <p className="text-[11px] text-[var(--ll-text-muted)]">
                    Teacher:{" "}
                    <span className="text-[var(--ll-text)]">
                      {enr.Class?.Teacher?.name ?? "—"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent grades */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
            Recent grades
          </p>
          {student.grades.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-faint)]">
              No grades recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {student.grades.map((g: any) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 border border-[var(--ll-border)] px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-[var(--ll-text)]">
                      {g.Class?.name}
                    </p>
                    <p className="text-[11px] text-[var(--ll-text-faint)]">
                      {new Date(g.computedAt).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[var(--ll-yellow)]">
                      {g.percent}%
                    </p>
                    <p className="text-[11px] text-[var(--ll-text-muted)]">
                      Grade: {g.letter}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Homework history */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
            Homework submissions
          </p>
          {student.homeworkSubmissions.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-faint)]">
              No homework submissions yet.
            </p>
          ) : (
            <div className="space-y-2">
              {student.homeworkSubmissions.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 border border-[var(--ll-border)] px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-[var(--ll-text)]">
                      {s.Homework?.title}
                    </p>
                    <p className="text-[11px] text-[var(--ll-text-faint)]">
                      {s.Homework?.Class?.name} ·{" "}
                      {new Date(s.submittedAt).toLocaleString("en-US")}
                    </p>
                  </div>
                  <div className="text-right">
                    {(s.teacherScore ?? s.aiScore) != null ? (
                      <>
                        <p className="text-lg font-semibold text-[var(--ll-yellow)]">
                          {s.teacherScore ?? s.aiScore}%
                        </p>
                        <p className="text-[11px] text-[var(--ll-text-muted)]">
                          Scored
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-[var(--ll-yellow)]">
                        Not graded yet
                      </p>
                    )}
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