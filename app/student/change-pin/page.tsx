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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-10 text-[var(--ll-text)]">
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 shadow-none shadow-black/30 backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ll-yellow)]">
          LiberiaLearn
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ll-text)]">Set a new PIN</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ll-text)]">
          Welcome! Please set a new PIN to secure your account.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--ll-text)]">New PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-3 text-base text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Enter 4 to 6 digits"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--ll-text)]">Confirm PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              required
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-3 text-base text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Re-enter your new PIN"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || pin.length < 4 || confirmPin.length < 4}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--ll-yellow-soft)] px-5 text-sm font-semibold text-[var(--ll-text-faint)] transition hover:bg-[var(--ll-yellow-soft)] disabled:cursor-not-allowed disabled:bg-[var(--ll-surface-muted)] disabled:text-[var(--ll-text-muted)]"
          >
            {loading ? "Saving PIN..." : "Secure my account"}
          </button>
        </form>
      </div>
    </main>
  );
}
