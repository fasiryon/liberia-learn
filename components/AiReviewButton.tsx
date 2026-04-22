"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  submissionId: string;
  alreadyReviewed: boolean;
};

export function AiReviewButton({ submissionId, alreadyReviewed }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(alreadyReviewed);
  const [error, setError] = useState<string | null>(null);

  if (reviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-[var(--ll-yellow)]">
        AI Reviewed
      </span>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homework/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to run AI review");
      }
      setReviewed(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Review failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-[var(--ll-silver-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-silver-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Reviewing..." : "AI Review"}
      </button>
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
