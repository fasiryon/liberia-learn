"use client";

import { signOut } from "next-auth/react";
import { safeLogout } from "@/lib/safe-logout";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await safeLogout();
        await signOut({ callbackUrl: "/login" });
      }}
      className="rounded-xl border border-[var(--ll-border)] bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-[var(--ll-text)]"
    >
      Logout
    </button>
  );
}
