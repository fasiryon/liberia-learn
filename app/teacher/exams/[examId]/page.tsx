import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import ExamStatusControls from "./ExamStatusControls";

export const dynamic = "force-dynamic";

export default async function TeacherExamDetailPage({
  params,
}: {
  params: { examId: string };
}) {
  if (!isExamSystemEnabled()) {
    redirect("/teacher");
  }

  const user = await requireRole("TEACHER", "ADMIN");
  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, schoolId: user.schoolId ?? undefined, deletedAt: null },
    include: {
      class: {
        select: { name: true },
      },
      academicYear: {
        select: { yearLabel: true },
      },
      attempts: {
        include: {
          student: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
        orderBy: { submittedAt: "desc" },
      },
      questions: true,
    },
  });

  if (!exam) {
    redirect("/teacher/exams");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/teacher/exams" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Exams
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{exam.title}</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              {exam.subject} · Grade {exam.grade} · {exam.status}
            </p>
            <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
              {exam.class?.name ?? "Grade-wide"} · {exam.academicYear?.yearLabel ?? "No academic year"} ·{" "}
              {exam.resultsPublishedAt
                ? `Results released ${new Date(exam.resultsPublishedAt).toLocaleDateString()}`
                : "Results pending release"}
            </p>
          </div>
          <ExamStatusControls examId={exam.id} isAdmin={user.role === "ADMIN"} status={exam.status} />
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-lg font-semibold">Questions</h2>
          <div className="mt-4 space-y-3">
            {exam.questions.map((question, index) => (
              <div key={question.id} className="rounded-xl border border-[var(--ll-border)] bg-white/5 p-4">
                <p className="font-medium">
                  {index + 1}. {question.prompt}
                </p>
                <p className="mt-2 text-xs text-[var(--ll-text-muted)]">
                  MOE: {question.moeCode} · Correct option index: {question.correctIndex}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--ll-bg)]/90 text-[var(--ll-text)]">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Passed</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Tab Switches</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {exam.attempts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-[var(--ll-text-muted)]">
                    No attempts yet.
                  </td>
                </tr>
              ) : (
                exam.attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className={`border-t border-white/5 ${
                      attempt.integrityFlags.length > 0 ? "bg-[var(--ll-yellow-soft)]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      {attempt.student.user.name ?? attempt.student.user.email ?? attempt.student.id}
                    </td>
                    <td className="px-4 py-3">{Math.round(attempt.score * 100)}%</td>
                    <td className="px-4 py-3">{attempt.passed ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{attempt.integrityFlags.join(", ") || "None"}</td>
                    <td className="px-4 py-3">{attempt.tabSwitchCount}</td>
                    <td className="px-4 py-3">
                      {attempt.durationSeconds != null ? `${attempt.durationSeconds}s` : "Pending"}
                    </td>
                    <td className="px-4 py-3">
                      {attempt.submittedAt
                        ? new Date(attempt.submittedAt).toLocaleString()
                        : "In progress"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
