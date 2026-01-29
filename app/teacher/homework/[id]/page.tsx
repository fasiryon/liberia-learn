// app/teacher/homework/[id]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GradeSubmissionForm } from "@/components/GradeSubmissionForm";

export const dynamic = "force-dynamic";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    name?: string | null;
  };
};

export default async function TeacherHomeworkDetail({
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
  const homeworkId = params.id;

  const homework = await prisma.homework.findFirst({
    where: {
      id: homeworkId,
      Class: { teacherId },
    },
    include: {
      Class: {
        include: {
          School: true,
          enrollments: {
            include: {
              Student: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
      submissions: {
        include: {
          Student: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!homework) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Homework not found</h1>
          <p className="text-sm text-slate-400 mb-3">
            This assignment doesn&apos;t exist or doesn&apos;t belong to your
            classes.
          </p>
          <Link href="/teacher/homework" className="text-blue-300 text-sm">
            ← Back to homework list
          </Link>
        </div>
      </main>
    );
  }

  const totalStudents = homework.Class.enrollments.length;
  const submissions = homework.submissions;
  const submittedCount = submissions.length;
  const gradedCount = submissions.filter((s) => s.teacherScore !== null).length;

  const averageScore =
    gradedCount > 0
      ? Math.round(
          submissions.reduce((sum, s) => {
            if (s.teacherScore == null) return sum;
            return sum + s.teacherScore;
          }, 0) / gradedCount
        )
      : null;

  const questions = (homework.questions as any[]) || [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/teacher/homework?classId=${homework.classId}`}
              className="inline-block text-sm text-blue-300 hover:underline mb-3"
            >
              ← Back to homework list
            </Link>
            <h1 className="text-2xl font-bold mb-1">{homework.title}</h1>
            <p className="text-sm text-slate-400">
              {homework.Class.name} ·{" "}
              {homework.Class.School?.name || "Your school"}
            </p>
            {homework.dueAt && (
              <p className="mt-2 text-xs text-slate-500">
                Due: {new Date(homework.dueAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs text-right">
            <p className="text-slate-400 mb-1">Class summary</p>
            <p>
              Students: <span className="font-semibold">{totalStudents}</span>
            </p>
            <p>
              Submitted:{" "}
              <span className="font-semibold">
                {submittedCount}/{totalStudents}
              </span>
            </p>
            <p>
              Graded:{" "}
              <span className="font-semibold">
                {gradedCount}/{submittedCount}
              </span>
            </p>
            {averageScore !== null && (
              <p className="mt-1 text-emerald-300 font-semibold">
                Avg: {averageScore}%
              </p>
            )}
          </div>
        </header>

        {/* Instructions + Questions */}
        <section className="mb-6 grid gap-4 md:grid-cols-[2fr,3fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Instructions
            </h2>
            <p className="text-sm text-slate-200">
              {homework.instructions || "No specific instructions."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Questions
            </h2>
            <div className="space-y-3 text-sm text-slate-200">
              {questions.length === 0 ? (
                <p>No questions stored for this homework.</p>
              ) : (
                questions.map((q: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl bg-slate-950/80 px-4 py-3 border border-slate-800"
                  >
                    <p className="font-medium mb-1">
                      {i + 1}. {typeof q === "string" ? q : q.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Submissions + grading */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Submissions ({submittedCount}/{totalStudents})
          </h2>

          {totalStudents === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-400">
              No students are enrolled in this class yet.
            </div>
          ) : (
            <div className="space-y-4">
              {homework.Class.enrollments.map((enrollment) => {
                const s = enrollment.Student;
                const submission = submissions.find(
                  (sub) => sub.studentId === s.id
                );

                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">
                          {s.user?.name || "Unnamed student"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.user?.email || "No email"}
                        </p>
                        {submission ? (
                          <p className="mt-2 text-xs text-slate-400">
                            Submitted:{" "}
                            {new Date(
                              submission.submittedAt
                            ).toLocaleString()}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-amber-300">
                            Not submitted yet
                          </p>
                        )}
                      </div>

                      {submission ? (
                        <div className="flex-1 max-w-xl">
                          <GradeSubmissionForm
                            submissionId={submission.id}
                            initialScore={
                              submission.teacherScore !== null
                                ? submission.teacherScore
                                : null
                            }
                            initialNotes={submission.teacherNotes || null}
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          No work to grade yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
