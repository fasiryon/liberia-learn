"use client";

import { deriveConfidence, SAFE_GROUNDING_THRESHOLD } from "@/lib/ai/trust";
import type { AiConfidence } from "@/lib/ai/trust";

export type AITrustBadgeView = "student" | "teacher" | "admin";

export type AITrustBadgeProps = {
  confidenceScore: number;
  hadFallback: boolean;
  retrievalUsed?: boolean;
  view: AITrustBadgeView;
  className?: string;
};

const CONFIDENCE_CONFIG: Record<
  AiConfidence,
  { label: string; studentLabel: string; cls: string; dot: string }
> = {
  high: {
    label: "High confidence",
    studentLabel: "High confidence",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  medium: {
    label: "Medium confidence",
    studentLabel: "Medium confidence",
    cls: "bg-[var(--ll-warning)]/15 text-[var(--ll-warning)] border-[var(--ll-warning)]/30",
    dot: "bg-[var(--ll-warning)]",
  },
  low: {
    label: "Low confidence",
    studentLabel: "Limited curriculum grounding",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
};

export function AITrustBadge({
  confidenceScore,
  hadFallback,
  retrievalUsed = false,
  view,
  className = "",
}: AITrustBadgeProps) {
  const retrievalWeak =
    retrievalUsed && confidenceScore < SAFE_GROUNDING_THRESHOLD;
  const confidence = deriveConfidence({
    groundingScore: confidenceScore,
    hadFallback,
    retrievalWeak,
  });
  const config = CONFIDENCE_CONFIG[confidence];
  const label =
    view === "student" ? config.studentLabel : config.label;

  if (view === "student") {
    return (
      <span
        data-testid="ai-trust-badge"
        data-confidence={confidence}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.cls} ${className}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {label}
      </span>
    );
  }

  return (
    <span
      data-testid="ai-trust-badge"
      data-confidence={confidence}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.cls} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {label}
      <span className="opacity-70">
        ({Math.round(confidenceScore * 100)}%)
      </span>
    </span>
  );
}
