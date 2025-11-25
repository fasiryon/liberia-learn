// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-500/15 via-slate-950 to-slate-950" />

      <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-xl font-black text-slate-950">
              L
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-wide text-slate-100">
                LiberiaLearn
              </span>
              <span className="text-xs text-slate-400">
                AI-powered national learning
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-300 hover:text-white">
              Dashboard
            </Link>
            <Link href="/login">
              <span className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400">
                Log in
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-24 pt-16 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Liberia · Grade 1–12 · AI first
          </span>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
            One platform for{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              every Liberian student
            </span>
            .
          </h1>

          <p className="text-balance text-sm text-slate-300 sm:text-base">
            LiberiaLearn brings structured, mastery-based lessons, real-time
            progress, and AI tutors together in one dashboard — designed for
            low-bandwidth classrooms across Liberia.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/login">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400">
                Launch student portal
              </span>
            </Link>
            <Link href="/dashboard">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500">
                View sample dashboard
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-10 w-full max-w-md md:mt-0">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl shadow-emerald-500/20 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Today’s snapshot
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                demo preview
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-2xl bg-slate-900/80 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Active students
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">
                  1,248
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Lessons completed
                </p>
                <p className="mt-1 text-lg font-semibold text-cyan-300">
                  5,921
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Districts online
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-300">
                  12
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
