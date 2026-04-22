import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderSimpleMarkdown } from "@/lib/lessons";
import { isTextbookCompilerEnabled } from "@/lib/serverFlags";
import { getStudentTextbook } from "@/lib/ai/textbook/studentTextbook";
import TextbookOfflineCache from "../TextbookOfflineCache";
import PrintButton from "../PrintButton";

export const dynamic = "force-dynamic";

function label(subject: string) {
  return subject.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function StudentTextbookReaderPage({
  params,
}: {
  params: { subject: string };
}) {
  if (!isTextbookCompilerEnabled()) redirect("/dashboard");
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { currentGrade: true },
  });
  if (!student?.currentGrade) notFound();

  let subject: string;
  try {
    subject = decodeURIComponent(params.subject);
  } catch {
    notFound();
  }
  const textbook = await getStudentTextbook({
    subject,
    gradeLevel: student.currentGrade,
    schoolId: user.schoolId ?? null,
  });
  if (textbook.units.length === 0) notFound();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <TextbookOfflineCache cacheKey={`textbook:${student.currentGrade}:${textbook.subject}`} textbook={textbook} />
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/student/textbooks" className="text-sm font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to textbooks
          </Link>
          <PrintButton className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] print:hidden" />
        </div>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
            Grade {textbook.gradeLevel}
          </p>
          <h1 className="text-3xl font-bold text-[var(--ll-text)]">{label(textbook.subject)} Textbook</h1>
          <p className="text-sm text-[var(--ll-text)]">
            {textbook.totalLessons} lessons - {textbook.schoolName}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">Contents</p>
            <nav className="mt-3 space-y-2 text-sm">
              {textbook.units.map((unit) => (
                <a key={unit.id} href={`#unit-${unit.id}`} className="block rounded-xl bg-[var(--ll-bg)]/70 px-3 py-2 text-[var(--ll-text)] hover:text-[var(--ll-yellow)]">
                  {unit.orderIndex}. {unit.title}
                </a>
              ))}
            </nav>
            <PrintButton className="mt-4 w-full rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-bold text-[var(--ll-text-faint)] print:hidden" />
          </aside>

          <article className="space-y-6">
            {textbook.units.map((unit) => (
              <section key={unit.id} id={`unit-${unit.id}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
                  Unit {unit.orderIndex}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--ll-text)]">{unit.title}</h2>
                {unit.description ? <p className="mt-2 text-sm text-[var(--ll-text)]">{unit.description}</p> : null}

                <div className="mt-6 space-y-5">
                  {unit.lessons.map((lesson, index) => (
                    <section key={lesson.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-faint)]">
                        Chapter {index + 1}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--ll-text)]">{lesson.title}</h3>
                      <div
                        className="prose prose-invert mt-4 max-w-none prose-p:leading-8 prose-li:leading-8"
                        dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(lesson.content) }}
                      />
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </main>
  );
}
