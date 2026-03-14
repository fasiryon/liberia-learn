"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentChangePinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/student/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirmPin }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update PIN.");
        return;
      }

      router.push(data?.nextPath === "/student/placement" ? "/student/placement" : "/dashboard");
      router.refresh();
    } catch {
      setError("Unable to update PIN right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
          LiberiaLearn
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Set a new PIN</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Welcome! Please set a new PIN to secure your account.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">New PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Enter 4 to 6 digits"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Confirm PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              required
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-12 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Re-enter your new PIN"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || pin.length < 4 || confirmPin.length < 4}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Saving PIN..." : "Secure my account"}
          </button>
        </form>
      </div>
    </main>
  );
}
