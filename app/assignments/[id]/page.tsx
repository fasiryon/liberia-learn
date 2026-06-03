// app/assignments/[id]/page.tsx
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

export default async function HomeworkDetailPage({ params }: PageProps) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/");

  const userId = session.user.id as string;

  // Find the student row for this user
  const student = await prisma.student.findFirst({
    where: { userId },
  });

  if (!student) {
    redirect("/");
  }

  const homeworkId = params.id;

  // Load homework + this student's submission (if any)
  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
    include: {
      Class: {
        include: {
          School: true,
        },
      },
      submissions: {
        where: { studentId: student.id },
        take: 1,
      },
    },
  });

  if (!homework) {
    redirect("/assignments");
  }

  const submission = homework.submissions[0] ?? null;
  const questions = Array.isArray(homework.questions)
    ? (homework.questions as any[])
    : [];

  const className = homework.Class?.name ?? "Class";
  const schoolName = homework.Class?.School?.name ?? "School";
  const dueDate =
    homework.dueAt && new Date(homework.dueAt).toLocaleString("en-US");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-yellow)]">
              LIBERIALEARN · Homework
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{homework.title}</h1>
            <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
              {className} · {schoolName}
            </p>
            {dueDate && (
              <p className="text-[11px] text-[var(--ll-text-faint)]">
                Due: <span className="font-medium text-[var(--ll-text)]">{dueDate}</span>
              </p>
            )}
          </div>

          <Link
            href="/assignments"
            className="text-xs rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-[var(--ll-text)] hover:text-[var(--ll-text)]"
          >
            ← Back to assignments
          </Link>
        </div>

        {/* Status */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-1">
            Status
          </p>
          {submission ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded-full bg-[var(--ll-yellow)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--ll-yellow)]">
                Submitted
              </span>
              <p className="text-xs text-[var(--ll-text-muted)]">
                Submitted on{" "}
                {new Date(submission.submittedAt).toLocaleString("en-US")}
              </p>
              {(submission.teacherScore ?? submission.aiScore) != null && (
                <p className="text-xs text-[var(--ll-text-muted)]">
                  · Score:{" "}
                  <span className="font-semibold text-[var(--ll-yellow)]">
                    {submission.teacherScore ?? submission.aiScore}%
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--ll-yellow)]">
              Not submitted yet. Answer all questions below and then press{" "}
              <span className="font-semibold">Submit homework</span>.
            </p>
          )}
        </section>

        {/* Instructions */}
        {homework.instructions && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-2">
              Instructions
            </p>
            <p className="text-[var(--ll-text)] whitespace-pre-line">
              {homework.instructions}
            </p>
          </section>
        )}

        {/* Questions + form */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm space-y-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
            Questions
          </p>

          <form
            method="POST"
            action={`/api/student/homework/${homework.id}/submit`}
            className="space-y-4"
          >
            {questions.length === 0 && (
              <p className="text-xs text-[var(--ll-text-muted)]">
                Your teacher has not added questions to this homework yet. Check back soon.
              </p>
            )}

            {questions.map((q: any, index: number) => {
              const label =
                typeof q === "string"
                  ? q
                  : typeof q?.prompt === "string"
                  ? q.prompt
                  : `Question ${index + 1}`;

              const existingAnswers =
                (submission?.answers as any[] | null) ?? [];
              const existingValue =
                typeof existingAnswers[index] === "string"
                  ? existingAnswers[index]
                  : "";

              return (
                <div
                  key={index}
                  className="rounded-xl bg-[var(--ll-bg)]/80 border border-[var(--ll-border)] p-3 space-y-2"
                >
                  <p className="text-[var(--ll-text)] text-sm">
                    {index + 1}. {label}
                  </p>
                  <textarea
                    name={`answer-${index}`}
                    defaultValue={existingValue}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-xs text-[var(--ll-text)] outline-none focus:border-emerald-400"
                    placeholder="Type your answer here..."
                    required
                  />
                </div>
              );
            })}

            {questions.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-[var(--ll-text-faint)]">
                  Make sure each answer is clear before submitting.
                </p>
                <button
                  type="submit"
                  className="rounded-full bg-[var(--ll-yellow)] px-4 py-2 text-xs font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
                >
                  {submission ? "Update submission" : "Submit homework"}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
