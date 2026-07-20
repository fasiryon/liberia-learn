/**
 * Sprint 6.8: citation/grounding coverage for the real RAG-backed assistant
 * (GlobalAssistantShell -> /api/rag/query -> answerGroundedQuestion). Reuses
 * the existing AuditLog row that route already writes on every real request
 * (action: "ai.rag.query.requested") rather than a new table -- the route
 * was extended to also record groundingScore/hadFallback in `details`
 * alongside the sourceCount/retrievalWeak fields it already logged.
 *
 * Scope note: this does NOT cover /ai-tutor. That page reaches a separate,
 * unlogged code path (see project_tutor_architecture_consolidation_queue.md
 * in memory) -- flagged as a real finding, not silently folded into this
 * number.
 */
import { prisma } from "@/lib/db";

const LOOKBACK_DAYS = 30;
const RAG_QUERY_AUDIT_ACTION = "ai.rag.query.requested";

// Discriminant is a string literal (not boolean true/false) -- see the same
// note in lib/aiQuality/groundedness.ts (this project's tsconfig has
// "strict": false, which breaks reliable narrowing on boolean discriminants).
export type CitationCoverageMetric =
  | {
      status: "measurable";
      windowDays: number;
      totalInteractions: number;
      interactionsWithSources: number;
      coveragePct: number;
      avgGroundingScore: number | null;
      source: string;
      scopeNote: string;
    }
  | {
      status: "gap";
      reason: string;
      scopeNote: string;
    };

const SOURCE = 'AuditLog (action="ai.rag.query.requested") written by app/api/rag/query';
const SCOPE_NOTE =
  "Covers the RAG-backed global assistant (GlobalAssistantShell) only. /ai-tutor reaches a separate, unlogged code path -- see the tutor architecture consolidation queue.";

export async function getCitationCoverageMetric(): Promise<CitationCoverageMetric> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.auditLog.findMany({
    where: { action: RAG_QUERY_AUDIT_ACTION, createdAt: { gte: since } },
    select: { details: true },
  });

  if (rows.length === 0) {
    return {
      status: "gap",
      reason: `No real "${RAG_QUERY_AUDIT_ACTION}" interactions recorded in the last ${LOOKBACK_DAYS} days.`,
      scopeNote: SCOPE_NOTE,
    };
  }

  let withSources = 0;
  let groundingSum = 0;
  let groundingCount = 0;

  for (const row of rows) {
    const details = (row.details ?? {}) as Record<string, unknown>;
    const sourceCount = typeof details.sourceCount === "number" ? details.sourceCount : 0;
    if (sourceCount > 0) withSources += 1;

    const groundingScore = typeof details.groundingScore === "number" ? details.groundingScore : null;
    if (groundingScore !== null) {
      groundingSum += groundingScore;
      groundingCount += 1;
    }
  }

  return {
    status: "measurable",
    windowDays: LOOKBACK_DAYS,
    totalInteractions: rows.length,
    interactionsWithSources: withSources,
    coveragePct: (withSources / rows.length) * 100,
    avgGroundingScore: groundingCount > 0 ? groundingSum / groundingCount : null,
    source: SOURCE,
    scopeNote: SCOPE_NOTE,
  };
}
