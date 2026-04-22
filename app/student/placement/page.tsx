"use client";

import Link from "next/link";
import { useState } from "react";

export default function StudentPlacementIntroPage() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 shadow-none shadow-black/30 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
                  LiberiaLearn
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">
                  Grade Placement Assessment
                </h1>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm text-[var(--ll-yellow)]">
                <p className="font-semibold">MOE Logo Reference</p>
                <p className="mt-1 text-xs text-[var(--ll-yellow)]/80">
                  Ministry of Education, Republic of Liberia
                </p>
              </div>
            </div>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
              <p className="text-base leading-7 text-[var(--ll-text)]">
                This assessment helps us place you in the right grade level for your
                subjects. It takes about 20-30 minutes. Your teacher will review your
                results.
              </p>
              <p className="mt-4 text-sm leading-6 text-[var(--ll-text)]">
                After you finish, a teacher will review your placement. You will be
                notified by SMS when your placement is confirmed.
              </p>
            </section>

            <section className="rounded-xl border border-emerald-500/20 bg-[var(--ll-yellow)]/10 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">
                What to Expect
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-[var(--ll-text)]">
                <li className="rounded-xl bg-[var(--ll-bg)]/50 px-4 py-3">
                  Answer each question as best you can
                </li>
                <li className="rounded-xl bg-[var(--ll-bg)]/50 px-4 py-3">
                  There is no time limit - take your time
                </li>
                <li className="rounded-xl bg-[var(--ll-bg)]/50 px-4 py-3">
                  You can ask your teacher if you need help
                </li>
              </ul>
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--ll-text)]">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-yellow)] focus:ring-emerald-400"
                />
                <span>
                  I understand this assessment will be used to determine my grade
                  placement
                </span>
              </label>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--ll-border)] px-5 text-sm text-[var(--ll-text)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
                >
                  Back to Dashboard
                </Link>
                {acknowledged ? (
                  <Link
                    href="/placement"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ll-yellow-soft)] px-5 text-sm font-semibold text-[var(--ll-text-faint)] transition hover:bg-[var(--ll-yellow-soft)]"
                  >
                    Begin Assessment
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-full bg-[var(--ll-surface)] px-5 text-sm font-semibold text-[var(--ll-text-faint)]"
                  >
                    Begin Assessment
                  </button>
                )}
              </div>
            </section>

            <footer className="border-t border-[var(--ll-border)] pt-4 text-center text-xs uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
              Authorized by the Ministry of Education, Republic of Liberia
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
