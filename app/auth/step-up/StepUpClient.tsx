"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function safeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  return value;
}

export default function StepUpClient({ auth0Configured }: { auth0Configured: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
      <section className="w-full max-w-md space-y-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-yellow)]">
            Security check
          </p>
          <h1 className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
            Confirm this sensitive action
          </h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Re-enter your managed identity credentials and complete MFA. The confirmation is valid for a short period.
          </p>
        </div>
        {auth0Configured ? (
          <button
            type="button"
            onClick={() => signIn("auth0-step-up", { callbackUrl })}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-3 font-semibold text-[var(--ll-text-faint)]"
          >
            Verify with MFA
          </button>
        ) : (
          <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-3 text-sm text-red-300">
            Managed MFA is not configured. Contact the platform security owner.
          </p>
        )}
      </section>
    </main>
  );
}
