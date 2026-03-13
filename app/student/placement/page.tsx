"use client";

import Link from "next/link";
import { useState } from "react";

export default function StudentPlacementIntroPage() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  LiberiaLearn
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white">
                  Grade Placement Assessment
                </h1>
              </div>
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-semibold">MOE Logo Reference</p>
                <p className="mt-1 text-xs text-amber-50/80">
                  Ministry of Education, Republic of Liberia
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <p className="text-base leading-7 text-slate-200">
                This assessment helps us place you in the right grade level for your
                subjects. It takes about 20-30 minutes. Your teacher will review your
                results.
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                After you finish, a teacher will review your placement. You will be
                notified by SMS when your placement is confirmed.
              </p>
            </section>

            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
                What to Expect
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-100">
                <li className="rounded-xl bg-slate-950/50 px-4 py-3">
                  Answer each question as best you can
                </li>
                <li className="rounded-xl bg-slate-950/50 px-4 py-3">
                  There is no time limit - take your time
                </li>
                <li className="rounded-xl bg-slate-950/50 px-4 py-3">
                  You can ask your teacher if you need help
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                />
                <span>
                  I understand this assessment will be used to determine my grade
                  placement
                </span>
              </label>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-5 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100"
                >
                  Back to Dashboard
                </Link>
                <Link
                  href={acknowledged ? "/placement" : "#"}
                  aria-disabled={!acknowledged}
                  className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                    acknowledged
                      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      : "cursor-not-allowed bg-slate-800 text-slate-500"
                  }`}
                  onClick={(event) => {
                    if (!acknowledged) {
                      event.preventDefault();
                    }
                  }}
                >
                  Begin Assessment
                </Link>
              </div>
            </section>

            <footer className="border-t border-white/10 pt-4 text-center text-xs uppercase tracking-[0.18em] text-slate-400">
              Authorized by the Ministry of Education, Republic of Liberia
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
