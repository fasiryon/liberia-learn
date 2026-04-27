"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AITrustBadge } from "@/components/ai/AITrustBadge";
import { AITrustDetails } from "@/components/ai/AITrustDetails";
import type { AITrustSignal } from "@/lib/ai/trust";

type Props = {
  submissionId: string;
  alreadyReviewed: boolean;
};

const trustEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_TRUST_INDICATORS === "true";

export function AiReviewButton({ submissionId, alreadyReviewed }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(alreadyReviewed);
  const [error, setError] = useState<string | null>(null);
  const [trustSignal, setTrustSignal] = useState<AITrustSignal | null>(null);

  if (reviewed && !trustSignal) {
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
      const data = await res.json();
      setReviewed(true);
      if (data.trustSignal) setTrustSignal(data.trustSignal);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Review failed");
    } finally {
      setLoading(false);
    }
  }

  const showDetails =
    trustEnabled &&
    trustSignal &&
    (trustSignal.confidence === "low" || trustSignal.fallbackUsed);

  return (
    <div className="flex flex-col items-start gap-2">
      {reviewed ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-[var(--ll-yellow)]">
          AI Reviewed
        </span>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="rounded-lg bg-[var(--ll-silver-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-silver-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Reviewing..." : "AI Review"}
        </button>
      )}

      {trustEnabled && trustSignal && (
        <AITrustBadge
          confidenceScore={trustSignal.groundingScore}
          hadFallback={trustSignal.fallbackUsed}
          retrievalUsed={trustSignal.retrievalUsed}
          view="teacher"
        />
      )}

      {showDetails && (
        <AITrustDetails
          confidenceScore={trustSignal.groundingScore}
          hadFallback={trustSignal.fallbackUsed}
          retrievalUsed={trustSignal.retrievalUsed}
          model={trustSignal.model}
          provider={trustSignal.provider}
          generatedAt={trustSignal.generatedAt}
          explainability={trustSignal.explainability}
        />
      )}

      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
