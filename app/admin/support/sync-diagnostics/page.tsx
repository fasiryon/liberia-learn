"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SyncDiagnosticsLookupPage() {
  const router = useRouter();
  const [learnerId, setLearnerId] = useState("");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">Learner support</p>
          <h1 className="text-3xl font-bold">Sync diagnostics</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Read-only diagnosis of a learner&apos;s offline sync for learners in your school. Open it from a learner&apos;s page in{" "}
            <Link href="/admin/students" className="underline">Students</Link>, or enter the learner&apos;s user ID.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const id = learnerId.trim();
            if (id) router.push(`/admin/support/sync-diagnostics/${encodeURIComponent(id)}`);
          }}
        >
          <input
            value={learnerId}
            onChange={(event) => setLearnerId(event.target.value)}
            placeholder="Learner user ID"
            aria-label="Learner user ID"
            className="flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm hover:bg-[var(--ll-surface)]">
            View
          </button>
        </form>
      </div>
    </main>
  );
}
