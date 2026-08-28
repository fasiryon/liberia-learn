"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
import { safeLogout } from "@/lib/safe-logout";

export default function SignOutPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    setMessage(null);
    const result = await safeLogout({
      flushPendingSyncAttempt: async () => { await flushSubmissionQueue(); },
    });
    if (!result.completed) {
      setMessage(`${result.unsyncedCount} offline item${result.unsyncedCount === 1 ? "" : "s"} still need to sync. Your work remains saved on this device.`);
      setBusy(false);
      return;
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--ll-bg)] px-4 text-[var(--ll-text)]">
      <BrandMark size={28} />

      <div className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">Sign out of LiberiaLearn?</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">
          You will be returned to the sign-in page.
        </p>
        {message && <p role="alert" className="text-sm text-amber-200">{message}</p>}

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={busy}
            aria-busy={busy}
            className="w-full rounded-lg bg-[var(--ll-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90"
          >
            {busy ? "Checking offline work..." : "Sign out"}
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full rounded-lg border border-[var(--ll-border)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]"
          >
            Cancel — go back
          </button>
        </div>
      </div>
    </main>
  );
}
