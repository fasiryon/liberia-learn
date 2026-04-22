"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AcceptTransferPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [demoteSender, setDemoteSender] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/security/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, demoteSender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult("You are now a platform admin. Please log out and back in for the change to take effect.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] flex items-center justify-center">
        <p className="text-red-400">No transfer token provided.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] flex items-center justify-center">
      <div className="mx-auto max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8">
        <div>
          <h1 className="text-xl font-bold">Accept Platform Admin Transfer</h1>
          <p className="text-sm text-[var(--ll-text-muted)] mt-1">
            You have been invited to become a platform admin for LiberiaLearn.
          </p>
        </div>

        {result ? (
          <div className="rounded-lg border border-emerald-800 bg-[var(--ll-yellow-soft)] p-4">
            <p className="text-sm text-[var(--ll-yellow)]">{result}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={demoteSender}
                onChange={(e) => setDemoteSender(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--ll-border)] bg-[var(--ll-bg)]"
              />
              <label className="text-sm text-[var(--ll-text)]">
                Remove platform admin access from the sender
              </label>
            </div>

            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-violet-400 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Accept Platform Admin Role"}
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
