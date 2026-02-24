"use client";

/**
 * FindingActions — client component for finding detail action buttons.
 *
 * Actions:
 *   - Acknowledge (status: open → ack)
 *   - Resolve     (status: open|ack → resolved)
 *   - Generate AI Explanation (POST .../explain) — only when aiEnabled
 *
 * All actions are explicit — nothing fires automatically.
 * Escape hatch: "← Back to Findings" is in the parent page (server component).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  findingId: string;
  currentStatus: string;
  aiEnabled: boolean;
  hasExplanation: boolean;
}

export function FindingActions({ findingId, currentStatus, aiEnabled, hasExplanation }: Props) {
  const [loading, setLoading] = useState<"ack" | "resolved" | "explain" | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const router = useRouter();

  async function updateStatus(status: "ack" | "resolved") {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ops/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Update failed");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(null);
    }
  }

  async function generateExplanation() {
    setLoading("explain");
    setError(null);
    try {
      const res = await fetch(`/api/admin/ops/findings/${findingId}/explain`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? d.error ?? "Explanation failed");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(null);
    }
  }

  const isResolved = currentStatus === "resolved";

  return (
    <section aria-labelledby="actions-bar-heading" className="border-t border-slate-800 pt-5">
      <h2 id="actions-bar-heading" className="sr-only">Finding Actions</h2>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Acknowledge */}
        {!isResolved && currentStatus !== "ack" && (
          <button
            onClick={() => updateStatus("ack")}
            disabled={!!loading}
            aria-busy={loading === "ack"}
            className="rounded-xl border border-amber-700 bg-amber-900/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-900/60 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
          >
            {loading === "ack" ? "Acknowledging…" : "Acknowledge"}
          </button>
        )}

        {/* Resolve */}
        {!isResolved && (
          <button
            onClick={() => updateStatus("resolved")}
            disabled={!!loading}
            aria-busy={loading === "resolved"}
            className="rounded-xl border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          >
            {loading === "resolved" ? "Resolving…" : "Mark Resolved"}
          </button>
        )}

        {/* Generate explanation */}
        {aiEnabled && !hasExplanation && (
          <button
            onClick={generateExplanation}
            disabled={!!loading}
            aria-busy={loading === "explain"}
            className="rounded-xl border border-blue-700 bg-blue-900/40 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-900/60 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            {loading === "explain" ? "Generating…" : "✦ Generate AI Explanation"}
          </button>
        )}

        {isResolved && (
          <p className="text-sm text-emerald-400">✓ Resolved</p>
        )}
      </div>

      {/* Guardrail note */}
      {aiEnabled && !hasExplanation && (
        <p className="mt-2 text-xs text-slate-500">
          AI explanations are advisory only. No changes are applied automatically.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
