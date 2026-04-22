"use client";

import { useRouter } from "next/navigation";
import { guardianWelcomeStorageKey } from "@/app/guardian/GuardianWelcomeGate";

export default function GuardianWelcomeClient({
  guardianName,
  childName,
}: {
  guardianName: string;
  childName: string;
}) {
  const router = useRouter();

  function handleContinue() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(guardianWelcomeStorageKey, "true");
    }
    router.push("/guardian/dashboard");
  }

  return (
    <main className="ll-dashboard-shell px-4 py-8">
      <div className="ll-section mx-auto max-w-2xl rounded-xl p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-accent)]">
          Guardian Welcome
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          Welcome, {guardianName}. You&apos;re connected to {childName}.
        </h1>
        <ul className="mt-6 space-y-3 rounded-lg bg-[var(--ll-surface-muted)] p-5 text-sm text-[var(--ll-text-muted)]">
          <li>Track your child&apos;s progress and grades</li>
          <li>See attendance records</li>
          <li>Receive alerts when your child needs support</li>
        </ul>
        <button
          type="button"
          onClick={handleContinue}
          className="ll-focus mt-6 min-h-11 w-full rounded-lg bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-text-faint)]"
        >
          View My Child&apos;s Progress
        </button>
      </div>
    </main>
  );
}
