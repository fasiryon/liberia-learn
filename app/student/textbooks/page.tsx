import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTextbookCompilerEnabled } from "@/lib/serverFlags";
import { getStudentTextbookSubjects } from "@/lib/ai/textbook/studentTextbook";

export const dynamic = "force-dynamic";

function label(subject: string) {
  return subject.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function StudentTextbooksPage() {
  if (!isTextbookCompilerEnabled()) redirect("/dashboard");
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { currentGrade: true },
  });
  const grade = student?.currentGrade;
  const subjects = grade ? await getStudentTextbookSubjects({ gradeLevel: grade, schoolId: user.schoolId ?? null }) : [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          Back to dashboard
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Student textbooks
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Textbooks</h1>
          <p className="mt-2 text-sm text-slate-300">Grade {grade ?? "not set"} reading material by subject.</p>
        </div>

        {subjects.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-sm text-slate-300">
            No textbooks are available for your grade yet.
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <article key={subject} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <h2 className="text-lg font-semibold text-white">{label(subject)}</h2>
                <p className="mt-2 text-sm text-slate-300">Compiled from approved Grade {grade} curriculum units.</p>
                <Link
                  href={`/student/textbooks/${encodeURIComponent(subject)}`}
                  className="mt-5 inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  Open Textbook
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
