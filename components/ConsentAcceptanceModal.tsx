"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const EXEMPT_PATHS = [
  "/legal",
  "/privacy",
  "/terms",
  "/data-policy",
  "/contact",
  "/login",
  "/moe/login",
  "/register",
  "/guardian/register",
  "/forgot-password",
  "/reset-password",
  "/onboard",
];

function isExemptPath(pathname: string) {
  return EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function ConsentAcceptanceModal({
  initialAccepted,
  policyVersion,
}: {
  initialAccepted: boolean;
  policyVersion: string;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [accepted, setAccepted] = useState(initialAccepted);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accepted || isExemptPath(pathname)) return null;

  async function acceptPolicy() {
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/legal/accept-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyVersion }),
    });

    if (!response.ok) {
      setSubmitting(false);
      setError("We could not record acceptance. Please try again.");
      return;
    }

    setAccepted(true);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-consent-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/60 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Required policy acceptance
        </p>
        <h2 id="policy-consent-title" className="mt-3 text-2xl font-semibold text-white">
          Accept LiberiaLearn Terms and Privacy Policy
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          To continue using LiberiaLearn, you must accept the current Terms of Service and Privacy Policy.
          This applies to all student, teacher, guardian, school administrator, and Ministry portal accounts.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/legal/privacy"
            target="_blank"
            className="min-h-11 rounded-xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-100 hover:border-emerald-400"
          >
            View Privacy Policy
          </Link>
          <Link
            href="/legal/terms"
            target="_blank"
            className="min-h-11 rounded-xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-100 hover:border-emerald-400"
          >
            View Terms
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-5 text-slate-400">
          Policy version: <span className="font-semibold text-slate-200">{policyVersion}</span>. Acceptance is recorded
          with your user account and request IP address for compliance auditing.
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={submitting}
          onClick={acceptPolicy}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
        >
          {submitting ? "Recording acceptance..." : "I accept the Terms and Privacy Policy"}
        </button>
      </div>
    </div>
  );
}
