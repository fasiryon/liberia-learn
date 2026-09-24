"use client";

import { BrandMark } from "@/components/ui/BrandMark";
import { useSafeLogout } from "@/lib/hooks/useSafeLogout";

export default function SignOutPage() {
  const { busy, warning, logout, confirmLogoutKeepingWork, cancel } = useSafeLogout();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--ll-bg)] px-4 text-[var(--ll-text)]">
      <BrandMark size={28} />

      <div className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold">Sign out of LiberiaLearn?</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">
          You will be returned to the sign-in page.
        </p>
        {warning && <p role="alert" className="text-sm text-amber-200">{warning}</p>}

        <div className="flex flex-col gap-3 pt-2">
          {warning ? (
            <button
              type="button"
              onClick={confirmLogoutKeepingWork}
              disabled={busy}
              aria-busy={busy}
              className="w-full rounded-lg bg-[var(--ll-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90"
            >
              {busy ? "Signing out..." : "Sign out and keep my work for later"}
            </button>
          ) : (
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              aria-busy={busy}
              className="w-full rounded-lg bg-[var(--ll-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90"
            >
              {busy ? "Checking offline work..." : "Sign out"}
            </button>
          )}
          <button
            type="button"
            onClick={() => (warning ? cancel() : window.history.back())}
            className="w-full rounded-lg border border-[var(--ll-border)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]"
          >
            Cancel — go back
          </button>
        </div>
      </div>
    </main>
  );
}
