"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function SignOutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)]">
      <p className="text-sm text-[var(--ll-text-muted)]">Signing out…</p>
    </main>
  );
}
