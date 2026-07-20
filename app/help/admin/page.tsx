import Link from "next/link";
import { ADMIN_HELP_ARTICLES, IMPLEMENTATION_CALENDAR } from "@/lib/support/implementationPlaybook";

export default function AdminHelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
      <div className="flex items-center gap-3">
        <Link href="/help" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          Back to Help
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Admin Guide</h1>
        <p className="mt-2 text-[var(--ll-text-muted)]">
          Set up a school, verify first delivery, and prepare honest readiness evidence.
        </p>
      </div>

      <div className="space-y-6">
        {ADMIN_HELP_ARTICLES.map((article) => (
          <div key={article.title} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
            <h2 className="font-semibold text-[var(--ll-text)]">{article.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ll-text-muted)]">{article.body}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">30/60/90 day calendar</h2>
        {IMPLEMENTATION_CALENDAR.map((milestone) => (
          <div key={milestone.window} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">{milestone.window}</p>
            <h3 className="mt-2 font-semibold text-[var(--ll-text)]">{milestone.title}</h3>
            <p className="mt-3 text-sm font-semibold text-[var(--ll-text)]">Actions</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--ll-text-muted)]">
              {milestone.actions.map((action) => <li key={action}>- {action}</li>)}
            </ul>
            <p className="mt-3 text-sm font-semibold text-[var(--ll-text)]">Evidence</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--ll-text-muted)]">
              {milestone.evidence.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
