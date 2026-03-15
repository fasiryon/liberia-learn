import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import ExamStatusControls from "./ExamStatusControls";

export const dynamic = "force-dynamic";

export default async function TeacherExamDetailPage({ params }: { params: { examId: string } }) {
  if (!isExamSystemEnabled()) {
    redirect("/teacher");
  }

  const user = await requireRole("TEACHER", "ADMIN");
  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, schoolId: user.schoolId ?? undefined },
    include: {
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/teacher/exams" className="text-sm text-emerald-300 hover:text-emerald-200">&larr; Back to Exams</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{exam.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{exam.subject} · Grade {exam.grade} · {exam.status}</p>
          </div>
          <ExamStatusControls examId={exam.id} isAdmin={user.role === "ADMIN"} status={exam.status} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Questions</h2>
          <div className="mt-4 space-y-3">
            {exam.questions.map((question, index) => (
              <div key={question.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium">{index + 1}. {question.prompt}</p>
                <p className="mt-2 text-xs text-slate-400">MOE: {question.moeCode} · Correct option index: {question.correctIndex}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Passed</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {exam.attempts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-slate-400">No attempts yet.</td></tr>
              ) : (
                exam.attempts.map((attempt) => (
                  <tr key={attempt.id} className={`border-t border-white/5 ${attempt.integrityFlags.length > 0 ? "bg-amber-500/10" : ""}`}>
                    <td className="px-4 py-3">{attempt.student.user.name ?? attempt.student.user.email ?? attempt.student.id}</td>
                    <td className="px-4 py-3">{Math.round(attempt.score * 100)}%</td>
                    <td className="px-4 py-3">{attempt.passed ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{attempt.integrityFlags.join(", ") || "None"}</td>
                    <td className="px-4 py-3">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "In progress"}</td>
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
