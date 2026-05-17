"use client";

import { useState } from "react";
import Link from "next/link";

export function PrivacyGate({ onAccepted }: { onAccepted: () => void }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    if (!checked || loading) return;
    setLoading(true);
    try {
      await fetch("/api/user/privacy-accept", { method: "PATCH" });
      onAccepted();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="privacy-gate-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--ll-accent)] text-xl font-black text-[var(--ll-text-faint)]">
            L
          </div>
          <h2 id="privacy-gate-title" className="text-xl font-bold text-[var(--ll-text)]">
            Before you begin
          </h2>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Please review how LiberiaLearn protects your learning data.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4 text-sm text-[var(--ll-text-muted)] space-y-2">
          <p>LiberiaLearn stores your lesson progress, quiz scores, and attendance to help your teacher support your education.</p>
          <p>Your data is never sold or used for advertising. Only your teacher, school admin, and guardians you are linked with can see your records.</p>
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ll-yellow)] underline underline-offset-2 hover:text-[var(--ll-yellow)]"
          >
            Read the full Privacy Notice &rarr;
          </Link>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--ll-border)] accent-[var(--ll-yellow)]"
          />
          <span className="text-sm text-[var(--ll-text)]">
            I understand that LiberiaLearn stores my learning data to help my teacher support my education.
          </span>
        </label>

        <button
          type="button"
          disabled={!checked || loading}
          onClick={handleAccept}
          className="mt-2 flex w-full min-h-12 items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-3 text-base font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/30 hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50 transition"
        >
          {loading ? "Saving…" : "Continue to LiberiaLearn"}
        </button>
      </div>
    </div>
  );
}
