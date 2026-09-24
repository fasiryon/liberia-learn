"use client";

import { useSafeLogout } from "@/lib/hooks/useSafeLogout";

export default function SignOutButton() {
  const { busy, warning, logout, confirmLogoutKeepingWork, cancel } = useSafeLogout();

  return (
    <div className="flex items-center gap-2">
      {warning ? (
        <span role="alert" className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
          {warning}
          <button type="button" disabled={busy} onClick={confirmLogoutKeepingWork} className="underline font-semibold">
            Log out anyway
          </button>
          <button type="button" onClick={cancel} className="underline">
            Stay signed in
          </button>
        </span>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={logout}
        className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
      >
        Log out
      </button>
    </div>
  );
}
