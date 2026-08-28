"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { safeLogout } from "@/lib/safe-logout";

export default function SignOutButton() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-amber-200">{message}</span>}
      <button
        onClick={async () => {
          const result = await safeLogout();
          if (!result.completed) {
            setMessage(`${result.unsyncedCount} offline item${result.unsyncedCount === 1 ? "" : "s"} still need to sync.`);
            return;
          }
          await signOut({ callbackUrl: "/login" });
        }}
        className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
      >
        Log out
      </button>
    </div>
  );
}
