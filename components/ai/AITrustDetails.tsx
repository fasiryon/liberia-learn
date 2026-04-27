"use client";

import { deriveConfidence, SAFE_GROUNDING_THRESHOLD } from "@/lib/ai/trust";
import type { AiCitation, AiExplainability } from "@/lib/ai/trust";

export type AITrustDetailsProps = {
  confidenceScore: number;
  hadFallback: boolean;
  retrievalUsed?: boolean;
  citations?: AiCitation[];
  explainability?: AiExplainability;
  model?: string;
  provider?: string;
  generatedAt?: string;
};

export function AITrustDetails({
  confidenceScore,
  hadFallback,
  retrievalUsed = false,
  citations = [],
  explainability,
  model,
  provider,
  generatedAt,
}: AITrustDetailsProps) {
  const retrievalWeak =
    retrievalUsed && confidenceScore < SAFE_GROUNDING_THRESHOLD;
  const confidence = deriveConfidence({
    groundingScore: confidenceScore,
    hadFallback,
    retrievalWeak,
  });

  return (
    <div
      data-testid="ai-trust-details"
      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)]">
        AI Trust Signal
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] text-[var(--ll-text-faint)]">Confidence</p>
          <p className="mt-0.5 font-semibold capitalize text-[var(--ll-text)]">
            {confidence}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--ll-text-faint)]">Grounding score</p>
          <p className="mt-0.5 font-semibold text-[var(--ll-text)]">
            {Math.round(confidenceScore * 100)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--ll-text-faint)]">Fallback used</p>
          <p
            className={`mt-0.5 font-semibold ${hadFallback ? "text-amber-400" : "text-emerald-400"}`}
          >
            {hadFallback ? "Yes" : "No"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--ll-text-faint)]">Retrieval</p>
          <p className="mt-0.5 font-semibold text-[var(--ll-text)]">
            {retrievalUsed ? "Used" : "Not used"}
          </p>
        </div>
      </div>

      {(hadFallback || confidence === "low") && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {hadFallback
            ? "Answer generated with limited context."
            : "Limited curriculum grounding — verify with source material."}
        </div>
      )}

      {explainability && (
        <div className="mt-3">
          <p className="text-[10px] text-[var(--ll-text-faint)]">Reasoning</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--ll-text-muted)]">
            {explainability.reasoningSummary}
          </p>
        </div>
      )}

      {citations.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-[var(--ll-text-faint)]">Sources used</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {citations.map((citation, index) => (
              <span
                key={index}
                className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--ll-text-muted)]"
              >
                {citation.sourceLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {(model || provider || generatedAt) && (
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--ll-text-faint)]">
          {model && <span>Model: {model}</span>}
          {provider && <span>Provider: {provider}</span>}
          {generatedAt && (
            <span>
              Generated:{" "}
              {new Date(generatedAt).toLocaleTimeString("en-LR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
