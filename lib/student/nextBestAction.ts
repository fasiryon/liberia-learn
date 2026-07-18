/**
 * lib/student/nextBestAction.ts, Sprint 6.7
 *
 * Deterministic, explainable "what should this student do next" ranking for
 * /student/today. Combines signals that already exist (persistent failure /
 * prerequisite gaps, overdue work, critical mastery alerts, today's schedule,
 * WAEC readiness, ordinary review, continue/advance) into one priority scale
 * using severity + urgency formulas rather than a fixed category stack, so a
 * severe signal in a low-priority category can still outrank a mild signal in
 * a high-priority category.
 *
 * Pure and side-effect free, all data is passed in already fetched. DB access
 * lives in the API route; this module is the unit-tested ranking surface.
 */

export type NextActionType =
  | "REVISIT_PREREQUISITE"
  | "OVERDUE"
  | "CRITICAL_MASTERY"
  | "SCHEDULED_TODAY"
  | "WAEC_PRACTICE"
  | "RETRY_ASSESSMENT"
  | "REVIEW"
  | "CONTINUE"
  | "ADVANCE";

export type NextActionCandidate = {
  type: NextActionType;
  priority: number;
  label: string;
  reason: string;
  href: string;
  subject: string;
  /** 0-100 mastery/score signal for tie-breaking, or null when not applicable. */
  masteryPercent: number | null;
  /** ISO timestamp of the underlying signal, for tie-break recency. */
  lastSignalAt: string | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 3+ attempts averaging below 65%, a blocking prerequisite gap. Range 85-95. */
export function scoreRevisitPrerequisite(avgScorePct: number): number {
  const clamped = Math.max(0, Math.min(65, avgScorePct));
  return round1(85 + ((65 - clamped) / 65) * 10);
}

/** Past-due assignment or a lesson abandoned mid-progress. Range 50-80, capped at 5 days. */
export function scoreOverdue(daysOverdue: number): number {
  const days = Math.max(0, daysOverdue);
  return 50 + Math.min(days * 6, 30);
}

/** A single subject score below 40%. Range 60-80. */
export function scoreCriticalMastery(scorePct: number): number {
  const clamped = Math.max(0, Math.min(40, scorePct));
  return round1(60 + ((40 - clamped) / 40) * 20);
}

/** Today's timetable/scheduled item. 70 for the live period, 55 otherwise. */
export function scoreScheduledToday(isCurrentPeriod: boolean): number {
  return isCurrentPeriod ? 70 : 55;
}

/**
 * WAEC readiness below the 75% practice threshold. Range 40-80, deliberately
 * wide: a mild dip (e.g. 70%, "Improving") stays non-urgent (~43), but a
 * genuinely severe gap can compete with critical-mastery-level signals, the
 * same magnitude-based logic every other category uses.
 */
export function scoreWaecPractice(readinessPct: number): number {
  const clamped = Math.max(0, Math.min(75, readinessPct));
  return round1(40 + ((75 - clamped) / 75) * 40);
}

/** A single quiz score below 60% (not yet a persistent pattern). Range 50-65. */
export function scoreRetryAssessment(scorePct: number): number {
  const clamped = Math.max(0, Math.min(60, scorePct));
  return round1(50 + ((60 - clamped) / 60) * 15);
}

/** Ordinary review, score 60-74%. Range 35-45. */
export function scoreReview(scorePct: number): number {
  const clamped = Math.max(60, Math.min(74, scorePct));
  return round1(35 + ((74 - clamped) / 14) * 10);
}

export const CONTINUE_PRIORITY = 30;
export const ADVANCE_PRIORITY = 20;

function dedupeByHref(candidates: NextActionCandidate[]): NextActionCandidate[] {
  const seen = new Set<string>();
  const out: NextActionCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.href)) continue;
    seen.add(candidate.href);
    out.push(candidate);
  }
  return out;
}

export type NextBestActionResult = {
  hero: NextActionCandidate | null;
  /** The top WAEC_PRACTICE candidate, when it exists and did not win the hero slot. */
  waecSecondary: NextActionCandidate | null;
  ranked: NextActionCandidate[];
};

/**
 * Ranks candidates by priority (descending), then by lowest mastery percent
 * (more severe first), then by most recent signal. WAEC-eligible students
 * with a real gap always get a visible slot, either as the hero or as a
 * guaranteed secondary card, because a mild WAEC gap can never win the
 * shared scale on its own (see Sprint 6.7 escalation record) without a
 * dedicated slot.
 */
export function rankNextBestActions(candidates: NextActionCandidate[]): NextBestActionResult {
  const ranked = dedupeByHref(candidates).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aMastery = a.masteryPercent ?? 100;
    const bMastery = b.masteryPercent ?? 100;
    if (aMastery !== bMastery) return aMastery - bMastery;
    const aTime = a.lastSignalAt ? Date.parse(a.lastSignalAt) : 0;
    const bTime = b.lastSignalAt ? Date.parse(b.lastSignalAt) : 0;
    return bTime - aTime;
  });

  const hero = ranked[0] ?? null;
  const waecCandidate = ranked.find((candidate) => candidate.type === "WAEC_PRACTICE") ?? null;
  const waecSecondary = waecCandidate && waecCandidate !== hero ? waecCandidate : null;

  return { hero, waecSecondary, ranked };
}
