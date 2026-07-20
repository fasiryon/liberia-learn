import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOnboardingReadinessReport } from "@/lib/readiness/readinessService";
import { IMPLEMENTATION_CALENDAR } from "@/lib/support/implementationPlaybook";

export const dynamic = "force-dynamic";

export default async function AdminLaunchChecklistPage() {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) redirect("/login");
  if (!user.schoolId) redirect("/admin");

  const report = await getOnboardingReadinessReport(user.schoolId);

  return (
    <main className="ll-dashboard-shell px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
              Back to admin
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-[var(--ll-text)]">Launch Checklist</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Live readiness checks for standing up a school on LiberiaLearn.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Readiness</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ll-text)]">{report.percentComplete}%</p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {report.steps.map((step) => (
            <div key={step.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--ll-text)]">{step.title}</h2>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    step.complete
                      ? "border-emerald-500/30 text-[var(--ll-yellow)]"
                      : "border-amber-500/30 text-amber-200"
                  }`}
                >
                  {step.complete ? "Complete" : "Needs work"}
                </span>
              </div>
              {step.missing.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-[var(--ll-text-muted)]">
                  {step.missing.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--ll-text-muted)]">
                  This check is backed by live school data.
                </p>
              )}
              <Link
                href={step.href}
                className="mt-4 inline-flex min-h-10 items-center rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
              >
                Open action
              </Link>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--ll-text)]">30/60/90 day implementation calendar</h2>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Built for LiberiaLearn school launch workflows and low-bandwidth school operations.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {IMPLEMENTATION_CALENDAR.map((milestone) => (
              <div key={milestone.window} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">
                  {milestone.window}
                </p>
                <h3 className="mt-2 text-base font-semibold text-[var(--ll-text)]">{milestone.title}</h3>
                <p className="mt-4 text-sm font-semibold text-[var(--ll-text)]">Actions</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--ll-text-muted)]">
                  {milestone.actions.map((action) => (
                    <li key={action}>- {action}</li>
                  ))}
                </ul>
                <p className="mt-4 text-sm font-semibold text-[var(--ll-text)]">Evidence</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--ll-text-muted)]">
                  {milestone.evidence.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
