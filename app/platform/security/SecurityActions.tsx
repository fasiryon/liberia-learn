"use client";

import { useState } from "react";

export function GenerateTokenButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ acceptUrl: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/security/transfer", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult({ acceptUrl: data.acceptUrl, expiresAt: data.expiresAt });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Transfer Token"}
      </button>
      {result && (
        <div className="rounded-lg border border-violet-800 bg-violet-950/40 p-3 text-xs space-y-1">
          <p className="text-violet-300">Transfer URL (expires {new Date(result.expiresAt).toLocaleString()}):</p>
          <p className="font-mono text-slate-200 break-all">{result.acceptUrl}</p>
          <p className="text-slate-500">Share this URL with the person you want to promote to platform admin.</p>
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
    return <p className="text-sm text-amber-400">You have been demoted. Please log out and back in.</p>;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleDemote}
        disabled={loading || disabled}
        className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Remove My Platform Admin Access"}
      </button>
      {disabled && (
        <p className="text-xs text-amber-400">
          Cannot demote: at least 2 platform admins required. Promote another admin first.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
