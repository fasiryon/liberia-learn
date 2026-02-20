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
      className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-50"
    >
      Log out
    </button>
  );
}
