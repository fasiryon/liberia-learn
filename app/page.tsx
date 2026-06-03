import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { PublicFooter } from "@/components/PublicFooter";
import { prisma } from "@/lib/db";

export const revalidate = 86400;

const capabilityBlocks = [
  {
    title: "Curriculum delivery",
    body: "Structured lessons, quizzes, multimedia modes, and textbooks aligned to classroom schedules.",
  },
  {
    title: "AI tutoring",
    body: "Grounded lesson help that respects grade level, subject context, and student safety.",
  },
  {
    title: "Offline-first access",
    body: "Students can keep learning through low bandwidth, cached lessons, and sync-aware workflows.",
  },
  {
    title: "National oversight",
    body: "MOE dashboards surface delivery, engagement, and multimedia usage without exposing student PII.",
  },
  {
    title: "Teacher tools",
    body: "Teachers manage lessons, assignments, video supplements, reports, and class interventions.",
  },
  {
    title: "Student outcomes",
    body: "Progress, exams, certificates, and daily learning paths make achievement visible.",
  },
];

export default async function HomePage() {
  let approvedLessonCount = 5832;
  try {
    approvedLessonCount = await prisma.curriculumContent.count({
      where: { status: { in: ["published", "APPROVED"] } },
    });
  } catch {
    // fallback to last-known value on DB error
  }
  const lessonStat = approvedLessonCount.toLocaleString("en-US");

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

      {/* ACT 1 — HERO */}
      <section className="ll-shell pb-10 pt-14 sm:pb-12 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.7fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ll-yellow)] mb-3">
              National K–12 Education Platform
            </p>

            <h1 className="text-4xl sm:text-5xl font-semibold text-[var(--ll-text)] leading-[1.1] mb-4">
              Liberia&apos;s students deserve<br />
              better than the<br />
              <span className="text-[var(--ll-yellow)]">status quo.</span>
            </h1>

            <p className="text-base text-[var(--ll-text-muted)] leading-7 mb-6 max-w-lg">
              LiberiaLearn gives every school AI-powered lessons, real-time teacher alerts,
              guardian progress updates, and national Ministry oversight — built for Liberia,
              from Grade 1 to Grade 12.
            </p>

            <div className="flex flex-wrap items-center gap-6 mb-8">
              <div>
                <p className="text-2xl font-semibold text-[var(--ll-text)]">{lessonStat}</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Approved lessons</p>
              </div>
              <div className="w-px h-8 bg-[var(--ll-border)] hidden sm:block" />
              <div>
                <p className="text-2xl font-semibold text-[var(--ll-text)]">8</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Subjects</p>
              </div>
              <div className="w-px h-8 bg-[var(--ll-border)] hidden sm:block" />
              <div>
                <p className="text-2xl font-semibold text-[var(--ll-text)]">Grades 1–12</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Full coverage</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/login"
                className="w-full sm:w-auto inline-flex items-center rounded-lg bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 transition-opacity duration-150"
              >
                Access the platform
              </a>
              <a
                href="/moe/login"
                className="w-full sm:w-auto inline-flex items-center rounded-lg border border-[var(--ll-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--ll-text-muted)] hover:border-[var(--ll-yellow)] hover:text-[var(--ll-yellow)] transition-colors duration-150"
              >
                Ministry officials →
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {capabilityBlocks.map((block) => (
              <div key={block.title} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <div className="mb-3 h-1 w-10 rounded-full bg-[var(--ll-accent)]" />
                <h2 className="text-base font-semibold text-[var(--ll-text)]">{block.title}</h2>
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{block.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VSL placeholder — replace div contents with iframe embed once video is recorded */}
      <section className="w-full py-10 px-4 border-t border-[var(--ll-border)]">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)] mb-2">
              See it in action
            </p>
            <h2 className="text-2xl font-semibold text-[var(--ll-text)]">
              How LiberiaLearn works
            </h2>
            <p className="text-sm text-[var(--ll-text-muted)] mt-2 max-w-md mx-auto">
              Watch how a student, teacher, and Ministry official each experience the platform.
            </p>
          </div>

          {/*
            TODO: Replace this placeholder with
            real video embed when VSL is recorded.

            YouTube embed:
            <iframe
              src="https://www.youtube.com/embed/VIDEO_ID"
              title="LiberiaLearn platform walkthrough"
              allow="accelerometer; autoplay;
                clipboard-write; encrypted-media;
                gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full
                h-full rounded-xl"
            />

            Replace VIDEO_ID with the YouTube video ID.
            When embedding: restore paddingBottom: '56.25%' for proper 16:9 ratio.
          */}

          {/* Video container — compact placeholder height until real video is embedded */}
          <div
            className="relative w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] overflow-hidden"
            style={{ height: "200px" }}
          >
            {/* Restore paddingBottom: '56.25%' when real video is embedded */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[var(--ll-yellow-soft)] border border-[var(--ll-yellow)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 4l14 8-14 8V4z" fill="var(--ll-yellow)" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--ll-text)]">Platform walkthrough</p>
                <p className="text-xs text-[var(--ll-text-faint)] mt-1">
                  90 seconds — Student, Teacher, Ministry
                </p>
              </div>
            </div>
          </div>

          {/* Role timestamps below video */}
          <div className="flex flex-wrap justify-center gap-6 mt-5">
            {[
              { time: "0:00", label: "Student experience" },
              { time: "0:35", label: "Teacher dashboard" },
              { time: "1:05", label: "Ministry overview" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--ll-yellow)]">{item.time}</span>
                <span className="text-xs text-[var(--ll-text-faint)]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACT 2 — SIGN IN FOR YOUR ROLE (combined sign-in + role descriptions) */}
      <section className="w-full py-10 px-4 border-t border-[var(--ll-border)]">
        <div className="mx-auto max-w-5xl">

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)] mb-6">
            Sign in for your role
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Student */}
            <a href="/login"
              className="ll-section p-4 rounded-xl hover:border-[var(--ll-yellow)] transition-colors duration-150 group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--ll-text)]">
                  Students
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className="text-[var(--ll-text-faint)] group-hover:text-[var(--ll-yellow)] transition-colors">
                  <path d="M3 7h8M7 3l4 4-4 4"
                    stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-xs text-[var(--ll-text-faint)] leading-5">
                Lessons, labs, AI tutor,
                and daily learning paths.
              </p>
            </a>

            {/* Teacher */}
            <a href="/login"
              className="ll-section p-4 rounded-xl hover:border-[var(--ll-yellow)] transition-colors duration-150 group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--ll-text)]">
                  Teachers
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className="text-[var(--ll-text-faint)] group-hover:text-[var(--ll-yellow)] transition-colors">
                  <path d="M3 7h8M7 3l4 4-4 4"
                    stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-xs text-[var(--ll-text-faint)] leading-5">
                Scheduling, grading, alerts,
                and class intelligence.
              </p>
            </a>

            {/* Guardian */}
            <a href="/login"
              className="ll-section p-4 rounded-xl hover:border-[var(--ll-yellow)] transition-colors duration-150 group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--ll-text)]">
                  Guardians
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className="text-[var(--ll-text-faint)] group-hover:text-[var(--ll-yellow)] transition-colors">
                  <path d="M3 7h8M7 3l4 4-4 4"
                    stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-xs text-[var(--ll-text-faint)] leading-5">
                Child progress, teacher messages,
                and learning summaries.
              </p>
            </a>

            {/* School Admin */}
            <a href="/login"
              className="ll-section p-4 rounded-xl hover:border-[var(--ll-yellow)] transition-colors duration-150 group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--ll-text)]">
                  School Administrators
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className="text-[var(--ll-text-faint)] group-hover:text-[var(--ll-yellow)] transition-colors">
                  <path d="M3 7h8M7 3l4 4-4 4"
                    stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-xs text-[var(--ll-text-faint)] leading-5">
                Enrollment, curriculum coverage,
                pilot readiness, and compliance.
              </p>
            </a>

            {/* MOE */}
            <a href="/moe/login"
              className="ll-section p-4 rounded-xl hover:border-[var(--ll-silver)] transition-colors duration-150 group sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--ll-text)]">
                  Ministry Officials
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className="text-[var(--ll-text-faint)] group-hover:text-[var(--ll-silver)] transition-colors">
                  <path d="M3 7h8M7 3l4 4-4 4"
                    stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-xs text-[var(--ll-text-faint)] leading-5">
                National oversight, district analytics,
                and curriculum governance.
              </p>
            </a>

          </div>

          <p className="text-xs text-[var(--ll-text-faint)] mt-4">
            Don&apos;t have an account?{' '}
            <a href="/enroll" className="text-[var(--ll-yellow)] hover:opacity-80">
              Enroll your school →
            </a>
          </p>

        </div>
      </section>

      {/* ACT 3 — MINISTRY CTA (compact strip) */}
      <section className="w-full py-8 px-4 border-t border-[var(--ll-border)]">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--ll-text)]">
              Ready for national deployment
            </p>
            <p className="text-xs text-[var(--ll-text-faint)] mt-1">
              Schedule a walkthrough for Ministry of Education stakeholders.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="/pilot-preview"
              className="rounded-lg px-4 py-2 bg-[var(--ll-yellow)] text-[var(--ll-bg)] text-sm font-medium hover:opacity-90 transition-opacity">
              Request a briefing
            </a>
            <a href="/moe/login"
              className="rounded-lg px-4 py-2 border border-[var(--ll-border-strong)] text-[var(--ll-text-muted)] text-sm hover:border-[var(--ll-yellow)] hover:text-[var(--ll-yellow)] transition-colors duration-150">
              Ministry login
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
