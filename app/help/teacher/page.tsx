import Link from "next/link";
import { TEACHER_HELP_ARTICLES } from "@/lib/support/implementationPlaybook";

export default function TeacherHelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
      <div className="flex items-center gap-3">
        <Link href="/help" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          Back to Help
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Teacher Guide</h1>
        <p className="mt-2 text-[var(--ll-text-muted)]">
          Complete training, teach scheduled lessons, review work, and use support signals.
        </p>
      </div>

      <div className="space-y-6">
        {TEACHER_HELP_ARTICLES.map((article) => (
          <div key={article.title} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
            <h2 className="font-semibold text-[var(--ll-text)]">{article.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ll-text-muted)]">{article.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
