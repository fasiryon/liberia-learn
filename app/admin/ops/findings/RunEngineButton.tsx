"use client";

/**
 * RunEngineButton — triggers POST /api/admin/ops/findings to run the engine.
 * Client component; used in the findings list page header.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunEngineButton({ schoolId }: { schoolId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ops/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error ?? "Unknown"}`);
      } else {
        setResult(`Created ${data.created} finding${data.created !== 1 ? "s" : ""} (${data.deduped} deduped)`);
        router.refresh();
      }
    } catch {
      setResult("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRun}
        disabled={loading}
        aria-busy={loading}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
      >
        {loading ? "Running…" : "Run Engine Now"}
      </button>
      {result && (
        <p className="text-xs text-slate-400 text-right max-w-xs">{result}</p>
      )}
    </div>
  );
}
