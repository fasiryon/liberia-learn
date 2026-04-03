import Link from "next/link";
import { isDemoModeEnabled } from "@/lib/serverFlags";

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
  "Grounded responses with confidence, grounding score, and citations",
  "Role-aware explainability for teacher and admin workflows",
  "Tenant-safe caching, RBAC, and school-scoped data access",
  "Rate limiting and AI cost observability on admin surfaces",
];

const demoLinks = [
  { label: "Student demo", href: "/login?role=student" },
  { label: "Teacher demo", href: "/login?role=teacher" },
  { label: "Guardian demo", href: "/login?role=guardian" },
  { label: "Admin demo", href: "/login?role=admin" },
];

export default function HomePage() {
  const demoModeEnabled = isDemoModeEnabled();

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
            <Link href="/admin/pilot-readiness" className="hidden sm:inline-flex">
              <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-medium text-slate-100 hover:border-slate-500">
                Review pilot readiness
              </span>
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Trust layer
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Safer AI for real classrooms
              </h2>
            </div>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              Grounded
            </span>
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
            Teacher and admin AI flows can expose citations and high-level explainability.
            Student and guardian views stay simplified and avoid internal implementation detail.
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
              Why it matters
            </p>
            <h2 className="text-2xl font-semibold text-slate-50">
              Built for real operations, not just demos
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              The repo already implements offline queueing, guardian-safe shaping,
              school-scoped intelligence, pilot readiness scoring, and feature-flag
              rollouts. The goal is operational confidence in low-bandwidth, real-world
              classrooms rather than a single polished demo path.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-amber-400/15 bg-amber-400/8 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">
              Pilot call to action
            </p>
            <h3 className="text-xl font-semibold text-slate-50">
              Review the pilot surfaces with school and ministry stakeholders
            </h3>
            <p className="text-sm leading-6 text-slate-300">
              Use the readiness, delivery, intelligence, and guardian flows to validate
              whether a school is operationally prepared for a staged rollout.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/admin/pilot-readiness">
                <span className="inline-flex rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-200">
                  Open readiness review
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Explore Demo
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                Role-based walkthrough entry points
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Open the sign-in flow with the role already selected. Seeded test credentials
              are available only when `DEMO_MODE=true`.
            </p>
          </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
              {demoModeEnabled ? "Demo hints enabled" : "Demo hints hidden"}
            </span>
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
    </main>
  );
}
