"use client";

import { useState } from "react";

export function GenerateTokenButton() {
  const [loading, setLoading] = useState(false);
  const [intendedUserId, setIntendedUserId] = useState("");
  const [result, setResult] = useState<{ token: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/security/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intendedUserId: intendedUserId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult({ token: data.token, expiresAt: data.expiresAt });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-[var(--ll-text)]">
        Intended recipient user ID
        <input
          value={intendedUserId}
          onChange={(event) => setIntendedUserId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
          placeholder="user_..."
        />
      </label>
      <button
        onClick={handleGenerate}
        disabled={loading || !intendedUserId.trim()}
        className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-[var(--ll-text)] hover:bg-violet-400 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Transfer Token"}
      </button>
      {result && (
        <div className="rounded-lg border border-violet-800 bg-violet-950/40 p-3 text-xs space-y-1">
          <p className="text-violet-300">One-time transfer token (expires {new Date(result.expiresAt).toLocaleString()}):</p>
          <p className="font-mono text-[var(--ll-text)] break-all">{result.token}</p>
          <p className="text-[var(--ll-text-faint)]">Deliver this token directly to the intended recipient. It is not embedded in a URL.</p>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function SelfDemoteButton({ adminCount }: { adminCount: number }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = adminCount < 2;

  async function handleDemote() {
    if (!confirm("Are you sure you want to remove your platform admin access?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/security/demote", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="text-sm text-[var(--ll-yellow)]">You have been demoted. Please log out and back in.</p>;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleDemote}
        disabled={loading || disabled}
        className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-[var(--ll-text)] hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Remove My Platform Admin Access"}
      </button>
      {disabled && (
        <p className="text-xs text-[var(--ll-yellow)]">
          Cannot demote: at least 2 platform admins required. Promote another admin first.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
