/**
 * app/pilot-preview/page.tsx
 *
 * Public interstitial that explains the gated pilot preview before directing
 * visitors to the appropriate login. Replaces the direct link to
 * /admin/pilot-readiness which would drop unauthenticated visitors on a
 * generic login page with no context.
 */
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata = {
  title: "Pilot Readiness Preview — LiberiaLearn",
};

const accessPaths = [
  {
    role: "Ministry Officials (MOE)",
    description:
      "Access the national delivery compliance, curriculum health, and intervention impact dashboards.",
    href: "/moe/login",
    label: "MOE Portal sign-in",
    accent: "border-blue-500/30 bg-[var(--ll-silver-soft)]",
    buttonClass:
      "w-full rounded-lg px-4 py-2.5 text-sm font-semibold bg-[var(--ll-yellow)] text-[var(--ll-bg)] hover:opacity-90 transition-opacity duration-150 min-h-[44px]",
  },
  {
    role: "School Administrators",
    description:
      "Review pilot readiness scores, delivery compliance, and school-level intelligence dashboards.",
    href: "/login?role=admin&next=/admin/pilot-score",
    label: "Admin sign-in",
    accent: "border-amber-500/30 bg-[var(--ll-yellow-soft)]",
    buttonClass:
      "w-full rounded-lg px-4 py-2.5 text-sm font-semibold border border-[var(--ll-yellow)] text-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)] hover:opacity-90 transition-opacity duration-150 min-h-[44px]",
  },
  {
    role: "Teachers",
    description:
      "Access lesson delivery scheduling, assignment and grading tools, and student progress views.",
    href: "/login?role=teacher",
    label: "Teacher sign-in",
    accent: "border-emerald-500/30 bg-[var(--ll-yellow)]/8",
    buttonClass:
      "w-full rounded-lg px-4 py-2.5 text-sm font-semibold border border-[var(--ll-silver)] text-[var(--ll-silver)] bg-[var(--ll-silver-soft)] hover:opacity-90 transition-opacity duration-150 min-h-[44px]",
  },
];

export default function PilotPreviewPage() {
  return (
    <main className="ll-page flex min-h-screen flex-col bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <header className="border-b border-white/5 bg-[var(--ll-bg)]/70 backdrop-blur">
        <div className="ll-shell flex items-center gap-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ll-yellow-soft)] text-base font-black text-[var(--ll-text-faint)]">
              L
            </div>
            <span className="text-sm font-semibold text-[var(--ll-text)]">LiberiaLearn</span>
          </Link>
        </div>
      </header>

      <div className="ll-shell flex-1 py-12">
        <div className="max-w-3xl space-y-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-medium text-[var(--ll-yellow)]">
              <span className="h-2 w-2 rounded-full bg-[var(--ll-yellow-soft)]" />
              Gated pilot preview
            </span>

            <h1 className="text-3xl font-semibold tracking-tight text-[var(--ll-text)] sm:text-4xl">
              Pilot readiness and delivery review
            </h1>

            <p className="max-w-2xl text-base leading-7 text-[var(--ll-text)]">
              This area is for school administrators, teachers, and Ministry of Education officials
              participating in the LiberiaLearn national pilot. Select your role below to sign in
              and access the relevant dashboards and review surfaces.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/55 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)] mb-5">
              What is available in the pilot preview
            </h2>
            <ul className="space-y-3 text-sm text-[var(--ll-text)]">
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-yellow-soft)]" />
                <span>Pilot readiness scoring: MOE delivery checklists, infrastructure checks, and readiness gate status.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-yellow-soft)]" />
                <span>Delivery compliance: lesson scheduling, delivery tracking, and MOE standards coverage.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-yellow-soft)]" />
                <span>Student and school intelligence: adaptive assessments, intervention alerts, and progress trends.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-yellow-soft)]" />
                <span>Guardian SMS notifications: weekly digests and at-risk alerts (requires school configuration).</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
              Sign in for your role
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {accessPaths.map((path) => (
                <div
                  key={path.role}
                  className={`rounded-xl border p-5 space-y-3 ${path.accent}`}
                >
                  <p className="text-sm font-semibold text-[var(--ll-text)]">{path.role}</p>
                  <p className="text-xs leading-5 text-[var(--ll-text-muted)]">{path.description}</p>
                  <Link href={path.href}>
                    <span className={`inline-flex items-center justify-center ${path.buttonClass}`}>
                      {path.label}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[var(--ll-text-faint)]">
            Not a pilot participant?{" "}
            <Link href="/" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Return to homepage
            </Link>
            {" "}or{" "}
            <Link href="/contact" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              contact us
            </Link>{" "}
            to learn more about the LiberiaLearn national deployment.
          </p>
        </div>
      </div>

      <PublicFooter />
    </main>
  );
}
