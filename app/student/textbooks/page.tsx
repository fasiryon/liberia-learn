import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function subjectLabel(subject: string) {
  return subject.replace(/_/g, " ");
}

export default async function StudentTextbooksPage() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { currentGrade: true, user: { select: { schoolId: true } } },
  });

  const lessons = student?.currentGrade
    ? await prisma.curriculumContent.findMany({
        where: {
          grade: student.currentGrade,
          status: { in: ["APPROVED", "published"] },
          contentType: { in: ["lesson", "unit_plan", "term_plan", "full_pack"] },
        },
        orderBy: [{ subject: "asc" }, { updatedAt: "desc" }],
        take: 36,
        select: {
          contentId: true,
          title: true,
          subject: true,
          grade: true,
          contentType: true,
          payload: true,
        },
      })
    : [];

  const grouped = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const bucket = grouped.get(lesson.subject) ?? [];
    bucket.push(lesson);
    grouped.set(lesson.subject, bucket);
  }

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-shell max-w-6xl space-y-6">
        <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
          &larr; Back to Dashboard
        </Link>

        <header className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow-soft)] p-3 text-[var(--ll-yellow)]">
              <BookOpen className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-yellow)]">
                Textbook hub
              </p>
              <h1 className="mt-2 text-3xl font-semibold">My Textbooks</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">
                Approved lesson readings for your grade, grouped by subject. These are real curriculum entries, not a profile route.
              </p>
            </div>
          </div>
        </header>

        {grouped.size === 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">
              {!student?.currentGrade
                ? "Your grade hasn't been set yet. Ask your teacher to complete your placement so textbooks can load."
                : "No textbook readings are available for your grade yet. Your teacher can still assign lessons from the curriculum library."}
            </p>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from(grouped.entries()).map(([subject, entries]) => (
              <section key={subject} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
                <h2 className="text-lg font-semibold">{subjectLabel(subject)}</h2>
                <div className="mt-4 space-y-3">
                  {entries.slice(0, 8).map((entry) => {
                    const payload = entry.payload as { title?: string } | null;
                    const title = payload?.title ?? entry.title ?? entry.contentId;
                    return (
                      <Link
                        key={entry.contentId}
                        href={`/student/lesson/${entry.contentId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3 text-sm hover:border-[var(--ll-border-strong)]"
                      >
                        <span>
                          <span className="block font-medium text-[var(--ll-text)]">{title}</span>
                          <span className="text-xs text-[var(--ll-text-muted)]">Grade {entry.grade} - {entry.contentType.replace(/_/g, " ")}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
