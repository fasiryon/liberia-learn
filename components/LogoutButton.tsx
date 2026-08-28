"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { safeLogout } from "@/lib/safe-logout";

export default function LogoutButton() {
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
        className="rounded-xl border border-[var(--ll-border)] bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-[var(--ll-text)]"
      >
        Logout
      </button>
    </div>
  );
}
