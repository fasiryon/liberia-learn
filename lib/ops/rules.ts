/**
 * lib/ops/rules.ts
 *
 * Deterministic findings rules (Part A of the Self-Healing Ops Agent).
 *
 * Each rule is a pure function: (RuleContext) → FindingCandidate | null.
 * Rules ONLY read data — they never mutate DB, flags, or config.
 * recommendedFlags are for human review only; the engine never applies them.
 *
 * Adding a new rule:
 *   1. Write a `Rule` function below.
 *   2. Add it to `ALL_RULES`.
 *   3. Add a test in __tests__/ops-findings-engine.test.ts.
 */

import type {
  OnboardingAggregates,
  TrainingAggregates,
  SmsAggregates,
  OfflineAggregates,
} from "./aggregates";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FindingSeverity = "info" | "warn" | "critical";
export type FindingCategory = "sms" | "onboarding" | "training" | "offline" | "auth";

export interface RecommendedFlag {
  flag: string;
  setValue: string;
}

export interface FindingCandidate {
  severity: FindingSeverity;
  category: FindingCategory;
  signalKey: string;
  windowHours: number;
  baseline?: number;
  current?: number;
  deltaPct?: number;
  recommendedActions: string[];
  recommendedFlags: RecommendedFlag[];
}

export interface RuleContext {
  schoolId: string | null;
  onboarding: OnboardingAggregates;
  training: TrainingAggregates;
  sms: SmsAggregates;
  offline: OfflineAggregates;
}

export type Rule = (ctx: RuleContext) => FindingCandidate | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function deltaPct(current: number, baseline: number): number {
  if (baseline === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - baseline) / baseline) * 100);
}

// ── SMS Rules ─────────────────────────────────────────────────────────────────

/**
 * Triggers when the SMS failure rate exceeds 30 % (warn) or 60 % (critical).
 * Baseline: 10 % (expected occasional provider transients).
 */
export const smsHighFailureRate: Rule = (ctx) => {
  const { failureRate, windowHours } = ctx.sms;
  if (failureRate < 0.3) return null;
  const baseline = 0.1;
  return {
    severity: failureRate >= 0.6 ? "critical" : "warn",
    category: "sms",
    signalKey: "sms.high_failure_rate",
    windowHours,
    baseline,
    current: failureRate,
    deltaPct: deltaPct(failureRate, baseline),
    recommendedActions: [
      "Check the AfricasTalking provider status dashboard for active incidents.",
      "Review recent SMSDeliveryLog entries grouped by messageType to find patterns.",
      "If rate persists, pause bulk sends and switch to manual guardian contact.",
    ],
    recommendedFlags: [],
  };
};

/**
 * Triggers when throttled count exceeds 5 messages in the window.
 * A spike usually indicates misconfigured event triggers causing fan-out.
 */
export const smsThrottleSpike: Rule = (ctx) => {
  const { throttledCount, windowHours } = ctx.sms;
  if (throttledCount < 5) return null;
  return {
    severity: "warn",
    category: "sms",
    signalKey: "sms.throttle_spike",
    windowHours,
    current: throttledCount,
    recommendedActions: [
      "Identify which teachers or automated triggers are generating bulk SMS.",
      "Review SMS_THROTTLE_MAX_PER_WINDOW — consider raising to 5 for active sessions.",
      "Check for event-trigger misconfiguration causing duplicate absence notifications.",
    ],
    recommendedFlags: [{ flag: "SMS_THROTTLE_MAX_PER_WINDOW", setValue: "5" }],
  };
};

// ── Onboarding Rules ──────────────────────────────────────────────────────────

/**
 * Triggers when onboarding completion rate < 50 % AND at least 3 dismissals
 * have been recorded. Requires both conditions to avoid noise when very few
 * users have encountered the onboarding flow.
 */
export const onboardingLowCompletion: Rule = (ctx) => {
  const { completionRate, totalDismissed, windowHours } = ctx.onboarding;
  if (completionRate >= 0.5 || totalDismissed < 3) return null;
  const baseline = 0.8;
  return {
    severity: "warn",
    category: "onboarding",
    signalKey: "onboarding.low_completion",
    windowHours,
    baseline,
    current: completionRate,
    deltaPct: deltaPct(completionRate, baseline),
    recommendedActions: [
      "Review GuidedOnboarding step copy for clarity — use ≤ 8 words per instruction.",
      "Confirm NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING is set correctly for pilot schools.",
      "Survey 3-5 teachers about which steps feel confusing or blocking.",
    ],
    recommendedFlags: [
      { flag: "NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING", setValue: "true" },
    ],
  };
};

/**
 * Triggers when abandon rate exceeds 60 %. This is a separate signal from
 * low_completion — it fires even when total volume is low.
 */
export const onboardingAbandonSpike: Rule = (ctx) => {
  const { abandonRate, windowHours } = ctx.onboarding;
  if (abandonRate < 0.6) return null;
  const baseline = 0.2;
  return {
    severity: "warn",
    category: "onboarding",
    signalKey: "onboarding.abandon_spike",
    windowHours,
    baseline,
    current: abandonRate,
    deltaPct: deltaPct(abandonRate, baseline),
    recommendedActions: [
      "Cross-reference onboarding.dismissed events with stepIndex to find the drop-off step.",
      "Consider splitting high-friction steps or adding a 'Skip for now' path.",
      "Add contextual help text or a 1-minute video walkthrough to high-abandon steps.",
    ],
    recommendedFlags: [],
  };
};

// ── Training Rules ────────────────────────────────────────────────────────────

/**
 * Triggers when Level 1 completion rate is below 20 % (info) or 10 % (warn),
 * but only when at least 3 teachers are enrolled (avoids noise in tiny schools).
 */
export const trainingL1LowAdoption: Rule = (ctx) => {
  const { l1CompletionRate, totalTeachers, windowHours } = ctx.training;
  if (totalTeachers < 3 || l1CompletionRate >= 0.2) return null;
  const baseline = 0.5;
  return {
    severity: l1CompletionRate < 0.1 ? "warn" : "info",
    category: "training",
    signalKey: "training.l1_low_adoption",
    windowHours,
    baseline,
    current: l1CompletionRate,
    deltaPct: deltaPct(l1CompletionRate, baseline),
    recommendedActions: [
      "Send a direct reminder to teachers who haven't opened any Level 1 modules.",
      "Verify NEXT_PUBLIC_ENABLE_TRAINING_CENTER is active so the tab is visible.",
      "Schedule a 15-minute group walkthrough of the first two modules.",
    ],
    recommendedFlags: [
      { flag: "NEXT_PUBLIC_ENABLE_TRAINING_CENTER", setValue: "true" },
    ],
  };
};

/**
 * Triggers when module/level abandons exceed 10 (info) or 20 (warn) in window.
 */
export const trainingAbandonSpike: Rule = (ctx) => {
  const { totalAbandoned, windowHours } = ctx.training;
  if (totalAbandoned < 10) return null;
  return {
    severity: totalAbandoned >= 20 ? "warn" : "info",
    category: "training",
    signalKey: "training.abandon_spike",
    windowHours,
    current: totalAbandoned,
    recommendedActions: [
      "Review training.module_abandoned events grouped by moduleId to find bottlenecks.",
      "Shorten steps that exceed 120 words — target 40–60 words per step.",
      "Check ModulePlayer for broken screenshot placeholders that may confuse users.",
    ],
    recommendedFlags: [],
  };
};

// ── Offline Rules ─────────────────────────────────────────────────────────────

/**
 * Any dead-lettered queue item indicates a persistent sync failure that wasn't
 * resolved by normal retry logic. Always worth flagging.
 */
export const offlineDeadLetterNonzero: Rule = (ctx) => {
  const { deadLetterCount, windowHours } = ctx.offline;
  if (deadLetterCount === 0) return null;
  return {
    severity: "warn",
    category: "offline",
    signalKey: "offline.deadletter_nonzero",
    windowHours,
    current: deadLetterCount,
    recommendedActions: [
      "Inspect dead-lettered items in the offline queue — check lastError field.",
      "Verify network reliability at the affected school — consider offline-first checklist.",
      "Review sync retry policy (OFFLINE_RETRY_MAX) for conservative settings.",
    ],
    recommendedFlags: [],
  };
};

/**
 * Spike in sync conflicts: > 20 (warn) or > 50 (critical) in the window.
 * Usually caused by multi-device writes or a large batch-sync after outage.
 */
export const offlineConflictSpike: Rule = (ctx) => {
  const { conflictCount, windowHours } = ctx.offline;
  if (conflictCount < 20) return null;
  return {
    severity: conflictCount >= 50 ? "critical" : "warn",
    category: "offline",
    signalKey: "offline.conflict_spike",
    windowHours,
    current: conflictCount,
    recommendedActions: [
      "Check if multiple devices per teacher submitted work simultaneously after reconnect.",
      "Review conflict resolution logs — server-wins is the default policy (ADR-0001).",
      "Consider staggering sync intervals to reduce simultaneous write collisions.",
    ],
    recommendedFlags: [],
  };
};

// ── Rule registry ─────────────────────────────────────────────────────────────

export const ALL_RULES: Rule[] = [
  smsHighFailureRate,
  smsThrottleSpike,
  onboardingLowCompletion,
  onboardingAbandonSpike,
  trainingL1LowAdoption,
  trainingAbandonSpike,
  offlineDeadLetterNonzero,
  offlineConflictSpike,
];
