"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Metric = {
  label: string;
  baselineKey: string;
  actualKey: string;
  movementKey?: string;
  isCount?: boolean;
  inverseGood?: boolean;
};

const METRICS: Metric[] = [
  { label: "Detector Precision", baselineKey: "detectorPrecision", actualKey: "detectorPrecision", movementKey: "detectorPrecision" },
  { label: "False-Positive Rate", baselineKey: "falsePositiveRate", actualKey: "falsePositiveRate", movementKey: "falsePositiveRate", inverseGood: true },
  { label: "Recommendation Acceptance", baselineKey: "recommendationAcceptanceRate", actualKey: "recommendationAcceptanceRate", movementKey: "recommendationAcceptanceRate" },
  { label: "Approval Rejection Rate", baselineKey: "approvalRejectionRate", actualKey: "approvalRejectionRate", movementKey: "approvalRejectionRate", inverseGood: true },
  { label: "Workflow Stability", baselineKey: "workflowStability", actualKey: "workflowStability", movementKey: "workflowStability" },
  { label: "Rollback Occurrences", baselineKey: "", actualKey: "rollbackOccurrence", isCount: true },
  { label: "Tenant Safety Issues", baselineKey: "", actualKey: "tenantSafetyIncidents", isCount: true },
];

function fmtRate(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtCount(v: unknown): string {
  if (typeof v !== "number") return "—";
  return String(v);
}

function fmtDelta(delta: unknown, inverse = false): string {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(1)}pp`;
}

type MetricOutcome = "IMPROVED" | "DEGRADED" | "NEUTRAL";

function metricOutcome(delta: unknown, isCount: boolean, actual: unknown, inverseGood = false): MetricOutcome {
  if (isCount) {
    const n = typeof actual === "number" ? actual : null;
    if (n === null) return "NEUTRAL";
    return n === 0 ? "IMPROVED" : "DEGRADED";
  }
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "NEUTRAL";
  const threshold = 0.05;
  if (delta > threshold) return inverseGood ? "DEGRADED" : "IMPROVED";
  if (delta < -threshold) return inverseGood ? "IMPROVED" : "DEGRADED";
  return "NEUTRAL";
}

const OUTCOME_BADGE: Record<MetricOutcome, string> = {
  IMPROVED: "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800",
  DEGRADED: "inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800",
  NEUTRAL: "inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600",
};

const OVERALL_BADGE: Record<string, string> = {
  POSITIVE: "inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800",
  NEGATIVE: "inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800",
  MIXED: "inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800",
};

export function PostChangeEvalActionsPanel({
  evalPlan,
  changeRequestId,
  isPlatformAdmin,
  hasRolloutVerification,
}: {
  evalPlan: any;
  changeRequestId: string;
  isPlatformAdmin: boolean;
  hasRolloutVerification: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isComplete = evalPlan.feedbackLoopStatus === "COMPLETE";
  const hasActuals = Boolean(evalPlan.postChangeMetrics);
  const hasFindings = Boolean(evalPlan.findings);

  const showRecordButton =
    isPlatformAdmin && !isComplete && hasRolloutVerification && !hasActuals;
  const showCompleteButton =
    isPlatformAdmin && !isComplete && hasActuals;

  async function doAction(action: "record_metrics" | "complete") {
    setLoading(action);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/ops/optimization/change-requests/${changeRequestId}/post-change-eval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message ?? "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  const baseline = evalPlan.baselineMetrics as Record<string, unknown> | null;
  const actuals = evalPlan.postChangeMetrics as Record<string, unknown> | null;
  const movements = (evalPlan.findings as any)?.effectiveness?.movements as Record<string, unknown> | null;

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <section className="rounded border bg-[var(--ll-surface)] p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-[var(--ll-text-muted)]">Status: </span>
            <strong>{evalPlan.status}</strong>
          </div>
          <div>
            <span className="text-[var(--ll-text-muted)]">Evaluation window: </span>
            <strong>{evalPlan.evaluationWindowDays} days</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--ll-text-muted)]">Feedback loop: </span>
            {isComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                ✓ Feedback loop closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                ⏳ Evaluation in progress
              </span>
            )}
          </div>
          {evalPlan.overallOutcome && OVERALL_BADGE[evalPlan.overallOutcome] && (
            <span className={OVERALL_BADGE[evalPlan.overallOutcome]}>
              {evalPlan.overallOutcome === "POSITIVE" && "✓ "}
              {evalPlan.overallOutcome === "NEGATIVE" && "✗ "}
              {evalPlan.overallOutcome === "MIXED" && "~ "}
              {evalPlan.overallOutcome}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {(showRecordButton || showCompleteButton) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {showRecordButton && (
              <button
                onClick={() => doAction("record_metrics")}
                disabled={loading !== null}
                className="rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--ll-surface)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "record_metrics" ? "Recording…" : "Record Post-Change Metrics"}
              </button>
            )}
            {showCompleteButton && (
              <button
                onClick={() => doAction("complete")}
                disabled={loading !== null}
                className="rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--ll-surface)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "complete" ? "Closing…" : "Close Feedback Loop"}
              </button>
            )}
          </div>
        )}

        {actionError && (
          <p className="mt-2 text-xs text-red-600">{actionError}</p>
        )}
      </section>

      {/* Baseline metrics summary */}
      <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
        <h2 className="text-base font-semibold">Baseline Metrics</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {evalPlan.detectorPrecisionBaseline != null && (
            <div><span className="text-[var(--ll-text-muted)]">Detector precision: </span><strong>{(evalPlan.detectorPrecisionBaseline * 100).toFixed(1)}%</strong></div>
          )}
          {evalPlan.falsePositiveRateBaseline != null && (
            <div><span className="text-[var(--ll-text-muted)]">False-positive rate: </span><strong>{(evalPlan.falsePositiveRateBaseline * 100).toFixed(1)}%</strong></div>
          )}
          {evalPlan.approvalRejectionBaseline != null && (
            <div><span className="text-[var(--ll-text-muted)]">Approval rejection rate: </span><strong>{(evalPlan.approvalRejectionBaseline * 100).toFixed(1)}%</strong></div>
          )}
          {evalPlan.confidenceScore != null && (
            <div><span className="text-[var(--ll-text-muted)]">Confidence: </span><strong>{(evalPlan.confidenceScore * 100).toFixed(0)}%</strong></div>
          )}
        </div>
      </section>

      {/* Findings table */}
      {hasActuals && (
        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-3">
          <h2 className="text-base font-semibold">Baseline vs Actual</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--ll-border)] text-left text-[var(--ll-text-muted)]">
                  <th className="py-2 pr-4 font-medium">Metric</th>
                  <th className="py-2 pr-4 font-medium">Baseline</th>
                  <th className="py-2 pr-4 font-medium">Actual</th>
                  <th className="py-2 pr-4 font-medium">Delta</th>
                  <th className="py-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const bVal = m.isCount ? null : baseline?.[m.baselineKey];
                  const aVal = actuals?.[m.actualKey];
                  const delta = m.movementKey ? movements?.[m.movementKey] : undefined;
                  const outcome = metricOutcome(delta, m.isCount ?? false, aVal, m.inverseGood);
                  return (
                    <tr key={m.label} className="border-b border-[var(--ll-border)] last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.label}</td>
                      <td className="py-2 pr-4 text-[var(--ll-text-muted)]">
                        {m.isCount ? "—" : fmtRate(bVal)}
                      </td>
                      <td className="py-2 pr-4">
                        {m.isCount ? fmtCount(aVal) : fmtRate(aVal)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--ll-text-muted)]">
                        {m.isCount ? "—" : fmtDelta(delta, m.inverseGood)}
                      </td>
                      <td className="py-2">
                        <span className={OUTCOME_BADGE[outcome]}>{outcome}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Findings summary */}
      {hasFindings && (
        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
          <h2 className="text-base font-semibold">Findings</h2>
          <div className="flex flex-wrap gap-2">
            {((evalPlan.findings as any)?.findings as string[] | undefined)?.map((f: string) => (
              <span key={f} className="rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-0.5 text-xs font-mono">
                {f}
              </span>
            ))}
          </div>
          {(evalPlan.findings as any)?.effectiveness?.effectivenessScore != null && (
            <div className="text-sm text-[var(--ll-text-muted)]">
              Effectiveness score:{" "}
              <strong>{((evalPlan.findings as any).effectiveness.effectivenessScore * 100).toFixed(0)}%</strong>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
