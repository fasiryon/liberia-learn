"use client";

import { signOut } from "next-auth/react";
import { safeLogout } from "@/lib/safe-logout";

export default function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await safeLogout();
        await signOut({ callbackUrl: "/login" });
      }}
      className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
    >
      Log out
    </button>
  );
}
