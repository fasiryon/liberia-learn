import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";

const roleCards = [
  {
    title: "Students",
    body:
      "Daily work, adaptive practice, exams, certifications, and offline-safe learning flows built for interrupted connectivity.",
  },
  {
    title: "Teachers",
    body:
      "Schedule delivery, grading, interventions, grounded AI support, and intelligence views that stay advisory and school-scoped.",
  },
  {
    title: "Guardians",
    body:
      "Simple progress summaries, safe home-support suggestions, and no internal school-only confusion detail.",
  },
  {
    title: "Schools",
    body:
      "Pilot readiness, compliance reporting, onboarding, prompt governance, and admin visibility without cross-tenant exposure.",
  },
];

const trustPillars = [
  "AI responses grounded in the national curriculum — not the open web",
  "Every role sees only what they are authorised to see",
  "School data stays school-scoped — no cross-institution leakage",
  "AI usage monitored and rate-controlled at every entry point",
];

const demoLinks = [
  { label: "Student sign-in", href: "/login?role=student" },
  { label: "Teacher sign-in", href: "/login?role=teacher" },
  { label: "Guardian sign-in", href: "/login?role=guardian" },
  { label: "Admin sign-in", href: "/login?role=admin" },
];

export default function HomePage() {
  return (
    <main className="ll-page min-h-screen text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_40%),radial-gradient(circle_at_80%_20%,_rgba(14,165,233,0.16),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#020617_42%,_#0f172a_100%)]" />

      <header className="border-b border-white/5 bg-slate-950/70 backdrop-blur">
        <div className="ll-shell flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-black text-slate-950">
              L
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-wide text-slate-100">
                LiberiaLearn
              </p>
              <p className="text-xs text-slate-400">
                Multi-role learning platform for Liberia
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link href="/moe/login" className="hidden text-slate-300 hover:text-white sm:inline">
              Ministry Officials
            </Link>
            <Link href="/login">
              <span className="inline-flex min-h-11 items-center rounded-full bg-emerald-400 px-5 py-2 font-semibold text-slate-950 hover:bg-emerald-300">
                Log in
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="ll-shell grid gap-8 pb-14 pt-12 lg:grid-cols-[1.25fr_0.95fr] lg:items-center lg:gap-10 lg:pt-16">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            National learning platform
          </span>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              AI-supported teaching and learning for Liberia&apos;s classrooms, families, and school systems.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              LiberiaLearn brings curriculum delivery, student practice, guardian progress,
              school operations, and grounded AI assistance into one platform designed for
              Grades 1-12 and low-resource deployment conditions.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login">
              <span className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300">
                Launch platform
              </span>
            </Link>
            <Link href="/pilot-preview" className="hidden sm:inline-flex">
              <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-medium text-slate-100 hover:border-slate-500">
                For Ministry officials
              </span>
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Built for national scale
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Government-grade infrastructure, built in
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {trustPillars.map((pillar) => (
              <div
                key={pillar}
                className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
              >
                {pillar}
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-400">
            Designed for deployment in low-bandwidth, low-resource school environments across all 15 Liberian counties.
          </p>
        </div>
      </section>

      <section className="ll-shell py-8 sm:py-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-white/8 bg-slate-900/55 p-6 shadow-lg shadow-slate-950/40"
            >
              <h2 className="text-lg font-semibold text-slate-50">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ll-shell py-8 sm:py-10">
        <div className="grid gap-6 rounded-[2rem] border border-white/8 bg-slate-900/55 p-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              What schools get on day one
            </p>
            <h2 className="text-2xl font-semibold text-slate-50">
              From enrollment to learning in minutes
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              School administrators enroll online, import student lists, and assign
              teachers — all without technical support. Students log in and begin working
              through the national curriculum immediately. Guardians receive progress
              updates by SMS.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-amber-400/15 bg-amber-400/8 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">
              For Ministry officials
            </p>
            <h3 className="text-xl font-semibold text-slate-50">
              Request a Ministry briefing
            </h3>
            <p className="text-sm leading-6 text-slate-300">
              LiberiaLearn is ready for national deployment. Schedule a walkthrough for
              Ministry of Education stakeholders or request access for a pilot school.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/pilot-preview">
                <span className="inline-flex rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-200">
                  Request a briefing
                </span>
              </Link>
              <Link href="/moe/login">
                <span className="inline-flex rounded-full border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400">
                  Ministry login
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ll-shell pb-16 pt-4 sm:pb-20 sm:pt-6">
        <div className="rounded-[2rem] border border-white/8 bg-slate-900/55 p-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Access the platform
            </p>
            <h2 className="text-2xl font-semibold text-slate-50">
              Sign in for your role
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Select your role below to go directly to the sign-in page. Contact your school
              administrator if you need help accessing your account.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {demoLinks.map((item) => (
              <Link key={item.label} href={item.href}>
                <span className="flex h-full min-h-16 items-center rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4 text-sm font-medium text-slate-100 hover:border-emerald-400/50 hover:text-white">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
