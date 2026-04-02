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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          Guardian Welcome
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          Welcome, {guardianName}. You&apos;re connected to {childName}.
        </h1>
        <ul className="mt-6 space-y-3 rounded-2xl bg-slate-950/60 p-5 text-sm text-slate-300">
          <li>📈 Track your child&apos;s progress and grades</li>
          <li>📅 See attendance records</li>
          <li>🔔 Receive alerts when your child needs support</li>
        </ul>
        <button
          type="button"
          onClick={handleContinue}
          className="mt-6 min-h-11 w-full rounded-2xl bg-emerald-400 px-5 py-3 text-base font-semibold text-slate-950"
        >
          View My Child&apos;s Progress
        </button>
      </div>
    </main>
  );
}
