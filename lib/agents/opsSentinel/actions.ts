/**
 * Ops Sentinel actions (docs/agents/OPS_SENTINEL.md).
 *
 * Tier 1 (provably safe - auto-executed): retrying a monitored cron once
 * (re-invokes the exact same route Vercel would call, no state mutation
 * beyond what that cron already does idempotently) and clearing a small,
 * explicit list of known-safe cache keys (safe because their values are
 * always re-derivable from source data - lib/cache/redisCache.ts's
 * withRedisCache degrades to a direct recompute on any cache miss, so
 * clearing is never destructive).
 *
 * Tier 2 (anything touching production-live tables or schema): never
 * auto-applied. Proposed via the existing EscalationQueue mechanism
 * (lib/agents/escalation.ts), same as every other agent-platform escalation
 * in this repo (Sprint 6.1 safeguarding/phone-update, etc.) - not a
 * separate approval system.
 */
import { enqueueEscalation } from "@/lib/agents/escalation";
import { invalidateCache } from "@/lib/cache/redisCache";
import { sendOpsAlert } from "@/lib/ops/alerts";
import { logger } from "@/lib/logger";
import type { Detection, DetectionSeverity } from "@/lib/agents/opsSentinel/detectors";

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app";
}

const CRON_ROUTE_PATHS: Record<string, string> = {
  "agents-tick": "/api/cron/agents/tick",
  "check-dlq": "/api/cron/check-dlq",
  "check-ai-budget": "/api/cron/check-ai-budget",
};

/** Tier 1: re-invoke a missed cron's own route once, exactly as Vercel would. */
export async function retryCron(cronName: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const path = CRON_ROUTE_PATHS[cronName];
  const cronSecret = process.env.CRON_SECRET;
  if (!path || !cronSecret) {
    return { ok: false, error: "no_retry_path_or_secret" };
  }

  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Known-safe, always-recomputable cache keys worth clearing on a detected
 * anomaly. Extend as new dashboard caches are added. */
const CLEARABLE_CACHE_KEYS = ["moe:dashboard"];

/** Tier 1: clear cache keys that are always safely re-derivable. */
export async function clearOpsCaches(): Promise<{ cleared: string[] }> {
  await Promise.all(CLEARABLE_CACHE_KEYS.map((key) => invalidateCache(key)));
  return { cleared: CLEARABLE_CACHE_KEYS };
}

/** Tier 2: propose a fix via the existing EscalationQueue - never auto-applied. */
export async function proposeFix(detection: Detection): Promise<{ escalationId: string }> {
  const priority: "LOW" | "MEDIUM" | "HIGH" = detection.severity;
  const { id } = await enqueueEscalation({
    agentName: "ops-sentinel",
    invocationId: null,
    reason: `[${detection.category}] ${detection.message}`,
    priority,
  });

  if (priority === "HIGH") {
    await sendOpsAlert({
      subject: `Ops Sentinel: ${detection.category} (HIGH)`,
      body: `${detection.message}\n\nDetails: ${JSON.stringify(detection.details, null, 2)}\n\nEscalation: ${id}`,
      channel: "email",
    }).catch((error) => {
      logger.warn("[ops-sentinel] alert failed, escalation still recorded", {
        escalationId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return { escalationId: id };
}

export type ActionSeverityMap = Record<Detection["category"], DetectionSeverity>;
