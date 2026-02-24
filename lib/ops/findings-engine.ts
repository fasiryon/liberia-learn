/**
 * lib/ops/findings-engine.ts
 *
 * Orchestrates the deterministic findings engine (Part A).
 *
 * Execution flow:
 *   1. Gather all ops aggregates (one DB round-trip batch per category).
 *   2. Run every rule in ALL_RULES against the aggregate context.
 *   3. For each non-null FindingCandidate:
 *        - Deduplicate: skip if an open/ack finding with the same signalKey
 *          already exists for this school within the windowHours.
 *        - Otherwise, create a new OpsFinding row.
 *   4. Return a summary of what was created / skipped.
 *
 * Constraints:
 *   - Read-only aggregates; rules NEVER mutate data.
 *   - recommendedFlags in findings are advisory only — this engine never
 *     applies flag changes.
 *   - No PII is stored in findings (aggregate values only).
 */

import { prisma } from "@/lib/db";
import { getOpsAggregates } from "./aggregates";
import { ALL_RULES, type FindingCandidate } from "./rules";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunEngineResult {
  schoolId: string | null;
  totalCandidates: number;
  created: number;
  deduped: number;
  findingIds: string[];
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Run the full findings engine for a given school.
 * Pass `schoolId = null` only for platform-admin global scans.
 *
 * Safe to call repeatedly — deduplication prevents duplicate findings
 * within the candidate's own windowHours.
 */
export async function runFindingsEngine(
  schoolId: string | null,
  windowHours = 168
): Promise<RunEngineResult> {
  // 1. Gather aggregates
  const aggregates = await getOpsAggregates(schoolId, windowHours);

  // 2. Evaluate rules
  const ctx = { schoolId, ...aggregates };
  const candidates: FindingCandidate[] = ALL_RULES.map((rule) => rule(ctx)).filter(
    (c): c is FindingCandidate => c !== null
  );

  // 3. Persist non-duplicate findings
  const findingIds: string[] = [];
  let deduped = 0;

  for (const candidate of candidates) {
    const dedupSince = new Date(
      Date.now() - candidate.windowHours * 60 * 60 * 1000
    );

    const existing = await prisma.opsFinding.findFirst({
      where: {
        signalKey: candidate.signalKey,
        schoolId: schoolId ?? null,
        status: { in: ["open", "ack"] },
        createdAt: { gte: dedupSince },
      },
      select: { id: true },
    });

    if (existing) {
      deduped++;
      continue;
    }

    const finding = await prisma.opsFinding.create({
      data: {
        schoolId:          schoolId ?? null,
        severity:          candidate.severity,
        category:          candidate.category,
        signalKey:         candidate.signalKey,
        windowHours:       candidate.windowHours,
        baseline:          candidate.baseline ?? null,
        current:           candidate.current  ?? null,
        deltaPct:          candidate.deltaPct ?? null,
        recommendedActions: candidate.recommendedActions as unknown as any,
        recommendedFlags:   candidate.recommendedFlags   as unknown as any,
        status:            "open",
      },
    });

    findingIds.push(finding.id);
  }

  return {
    schoolId,
    totalCandidates: candidates.length,
    created: findingIds.length,
    deduped,
    findingIds,
  };
}

// ── Prompt sanitizer (used by AI explain endpoint) ────────────────────────────

/**
 * Build a PII-free context object from a finding for use as AI prompt input.
 * Returns only aggregate signal values — never names, phones, or user IDs.
 */
export function buildSafePromptContext(finding: {
  signalKey: string;
  severity: string;
  category: string;
  windowHours: number;
  baseline: number | null;
  current: number | null;
  deltaPct: number | null;
  recommendedActions: unknown;
  recommendedFlags: unknown;
}): Record<string, unknown> {
  return {
    signalKey:         finding.signalKey,
    severity:          finding.severity,
    category:          finding.category,
    windowHours:       finding.windowHours,
    baseline:          finding.baseline,
    current:           finding.current,
    deltaPct:          finding.deltaPct,
    recommendedActions: Array.isArray(finding.recommendedActions)
      ? finding.recommendedActions
      : [],
    // recommendedFlags are included so the model can reference them —
    // they are flag names, not PII.
    recommendedFlags: Array.isArray(finding.recommendedFlags)
      ? finding.recommendedFlags
      : [],
  };
}
