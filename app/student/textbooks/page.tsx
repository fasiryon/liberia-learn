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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          Back to dashboard
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
            Student textbooks
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--ll-text)]">Textbooks</h1>
          <p className="mt-2 text-sm text-[var(--ll-text)]">Grade {grade ?? "not set"} reading material by subject.</p>
        </div>

        {subjects.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-sm text-[var(--ll-text)]">
            No textbooks are available for your grade yet.
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <article key={subject} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
                <h2 className="text-lg font-semibold text-[var(--ll-text)]">{label(subject)}</h2>
                <p className="mt-2 text-sm text-[var(--ll-text)]">Compiled from approved Grade {grade} curriculum units.</p>
                <Link
                  href={`/student/textbooks/${encodeURIComponent(subject)}`}
                  className="mt-5 inline-flex rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-bold text-[var(--ll-text-faint)]"
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
