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
    accent: "border-blue-500/30 bg-blue-500/8",
    buttonClass: "bg-blue-400 hover:bg-blue-300 text-slate-950",
  },
  {
    role: "School Administrators",
    description:
      "Review pilot readiness scores, delivery compliance, and school-level intelligence dashboards.",
    href: "/login?role=admin",
    label: "Admin sign-in",
    accent: "border-amber-500/30 bg-amber-500/8",
    buttonClass: "bg-amber-300 hover:bg-amber-200 text-slate-950",
  },
  {
    role: "Teachers",
    description:
      "Access lesson delivery scheduling, assignment and grading tools, and student progress views.",
    href: "/login?role=teacher",
    label: "Teacher sign-in",
    accent: "border-emerald-500/30 bg-emerald-500/8",
    buttonClass: "bg-emerald-400 hover:bg-emerald-300 text-slate-950",
  },
];

export default function PilotPreviewPage() {
  return (
    <main className="ll-page flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-white/5 bg-slate-950/70 backdrop-blur">
        <div className="ll-shell flex items-center gap-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400 text-base font-black text-slate-950">
              L
            </div>
            <span className="text-sm font-semibold text-slate-100">LiberiaLearn</span>
          </Link>
        </div>
      </header>

      <div className="ll-shell flex-1 py-12">
        <div className="max-w-3xl space-y-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              Gated pilot preview
            </span>

            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Pilot readiness and delivery review
            </h1>

            <p className="max-w-2xl text-base leading-7 text-slate-300">
              This area is for school administrators, teachers, and Ministry of Education officials
              participating in the LiberiaLearn national pilot. Select your role below to sign in
              and access the relevant dashboards and review surfaces.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-slate-900/55 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-5">
              What is available in the pilot preview
            </h2>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span>Pilot readiness scoring: MOE delivery checklists, infrastructure checks, and readiness gate status.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span>Delivery compliance: lesson scheduling, delivery tracking, and MOE standards coverage.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span>Student and school intelligence: adaptive assessments, intervention alerts, and progress trends.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span>Guardian SMS notifications: weekly digests and at-risk alerts (requires school configuration).</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sign in for your role
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {accessPaths.map((path) => (
                <div
                  key={path.role}
                  className={`rounded-3xl border p-5 space-y-3 ${path.accent}`}
                >
                  <p className="text-sm font-semibold text-slate-100">{path.role}</p>
                  <p className="text-xs leading-5 text-slate-400">{path.description}</p>
                  <Link href={path.href}>
                    <span
                      className={`mt-1 inline-flex rounded-full px-4 py-2 text-xs font-semibold ${path.buttonClass}`}
                    >
                      {path.label}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Not a pilot participant?{" "}
            <Link href="/" className="text-emerald-400 hover:text-emerald-300">
              Return to homepage
            </Link>
            {" "}or{" "}
            <Link href="/contact" className="text-emerald-400 hover:text-emerald-300">
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
