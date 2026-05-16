"use client";

import { useState } from "react";

type ResetCodeResult = {
  adminCode: string;
  expiresAt: string;
};

export function GenerateResetCodeButton({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/generate-reset-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate reset code");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const expiresLabel = new Date(result.expiresAt).toLocaleTimeString("en-LR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-center">
        <p className="text-xs font-medium text-amber-400">Reset code (expires {expiresLabel})</p>
        <p className="mt-1 text-2xl font-bold tracking-[0.4em] text-amber-300">
          {result.adminCode.split("").join(" ")}
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-1 text-xs text-amber-500 hover:text-amber-300"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex min-h-9 items-center rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-400 hover:border-amber-500/60 hover:bg-amber-950/40 disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate Reset Code"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
