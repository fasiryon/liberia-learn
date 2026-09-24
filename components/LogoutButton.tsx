"use client";

import { useSafeLogout } from "@/lib/hooks/useSafeLogout";

export default function LogoutButton() {
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
        className="rounded-xl border border-[var(--ll-border)] bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-[var(--ll-text)]"
      >
        Logout
      </button>
    </div>
  );
}
