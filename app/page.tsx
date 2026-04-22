import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
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

const trustStrip = [
  "National curriculum",
  "AI-powered tutoring",
  "Offline delivery",
  "Ministry-grade security",
];

const trustPillars = [
  "AI responses grounded in the national curriculum, not the open web",
  "Every role sees only what they are authorised to see",
  "School data stays school-scoped, with no cross-institution leakage",
  "AI usage is monitored and rate-controlled at every entry point",
];

const demoLinks = [
  { label: "Student sign-in", href: "/login?role=student" },
  { label: "Teacher sign-in", href: "/login?role=teacher" },
  { label: "Guardian sign-in", href: "/login?role=guardian" },
  { label: "Admin sign-in", href: "/login?role=admin" },
];

export default function HomePage() {
  return (
    <main className="ll-page min-h-screen text-[var(--ll-text)]">
      <header className="border-b border-[var(--ll-border)] bg-[var(--ll-bg)]">
        <div className="ll-shell flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <BrandMark size={20} />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[var(--ll-text)]">
                Liberia<span className="text-[var(--ll-accent)]">.</span>Learn
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--ll-text-faint)]">
                National K–12 Education Platform
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link href="/moe/login" className="hidden text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] sm:inline">
              Ministry Officials
            </Link>
            <Link href="/login">
              <span className="ll-interactive inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--ll-accent)] px-5 py-2 font-semibold text-[var(--ll-text-faint)]">
                <LogIn className="h-4 w-4" strokeWidth={1.5} />
                Log in
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="ll-shell pb-10 pt-14 sm:pb-12 sm:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.7fr)]">
          <div className="space-y-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ll-accent)]">
            National learning platform
          </p>

          <div className="space-y-4">
            <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-[var(--ll-text)] sm:text-5xl lg:text-6xl">
              Education infrastructure for every Liberian school.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--ll-text-muted)]">
              Curriculum delivery, AI tutoring, school operations, and national oversight —
              built for Grades 1–12 across all 15 counties.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login">
              <span className="ll-interactive inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--ll-accent)] px-6 py-3 text-sm font-semibold text-[var(--ll-text-faint)]">
                Access the platform
              </span>
            </Link>
            <Link href="/pilot-preview">
              <span className="ll-interactive inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--ll-border-strong)] px-6 py-3 text-sm font-medium text-[var(--ll-text)]">
                For Ministry officials
              </span>
            </Link>
          </div>
          </div>

          <div className="grid gap-3 text-sm">
            {[
              ["15", "counties supported"],
              ["3", "lesson modes"],
              ["5", "reviewer roles"],
            ].map(([value, label]) => (
              <div key={label} className="flex items-center justify-between border-b border-[var(--ll-border)] py-4">
                <span className="text-3xl font-semibold text-[var(--ll-text)]">{value}</span>
                <span className="text-right text-[var(--ll-text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ll-shell py-4">
        <div className="grid gap-3 md:grid-cols-4">
          {trustStrip.map((item) => (
            <div key={item} className="ll-card flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--ll-accent)]" />
              <span className="text-sm font-medium text-[var(--ll-text)]">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ll-shell py-8 sm:py-10">
        <div className="ll-section rounded-xl p-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ll-text-faint)]">
              Access the platform
            </p>
            <h2 className="text-2xl font-semibold text-[var(--ll-text)]">
              Sign in for your role
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">
              Select your role below to go directly to the sign-in page. Contact your school
              administrator if you need help accessing your account.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {demoLinks.map((item) => (
              <Link key={item.label} href={item.href}>
                <span className="ll-command ll-focus flex h-full min-h-16 text-sm font-medium text-[var(--ll-text)]">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ll-shell py-8 sm:py-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((card) => (
            <div key={card.title} className="ll-card p-6">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--ll-text-muted)]">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ll-shell py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="ll-section rounded-xl p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ll-text-faint)]">
              What schools get on day one
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--ll-text)]">
              From enrollment to learning in minutes
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ll-text-muted)]">
              School administrators enroll online, import student lists, and assign
              teachers, all without technical support. Students log in and begin working
              through the national curriculum immediately. Guardians receive progress
              updates by SMS.
            </p>
            <div className="mt-5 grid gap-2">
              {trustPillars.map((pillar) => (
                <p key={pillar} className="text-sm text-[var(--ll-text-muted)]">
                  {pillar}
                </p>
              ))}
            </div>
          </div>

          <div className="ll-section rounded-xl p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ll-warning)]">
              For Ministry officials
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--ll-text)]">
              Request a Ministry briefing
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--ll-text-muted)]">
              LiberiaLearn is ready for national deployment. Schedule a walkthrough for
              Ministry of Education stakeholders or request access for a pilot school.
            </p>
            <div className="flex flex-wrap gap-3 pt-5">
              <Link href="/pilot-preview">
                <span className="inline-flex rounded-lg bg-[var(--ll-warning)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90">
                  Request a briefing
                </span>
              </Link>
              <Link href="/moe/login">
                <span className="inline-flex rounded-lg border border-[var(--ll-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]">
                  Ministry login
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
