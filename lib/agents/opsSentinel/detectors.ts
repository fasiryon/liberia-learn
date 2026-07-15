/**
 * Ops Sentinel detectors (docs/agents/OPS_SENTINEL.md). Deterministic, not
 * LLM-judged - same philosophy as Sprint 6.1's safeguarding keyword gate:
 * safety/correctness-critical detection stays in code, not model judgment.
 * Each detector reuses an existing signal source rather than building a
 * parallel one (per the "not a separate system" requirement):
 *  - cron misses:      lib/ops/cronHeartbeat.ts (new - see there)
 *  - migration drift:  same _prisma_migrations query as app/api/health/route.ts
 *  - error spikes:     lib/ops/errorRates.ts (existing, MetricEvent-based)
 *  - cost cap breaches: AgentInvocation.status = "COST_CAPPED" (Sprint 6.0b)
 */
import { prisma } from "@/lib/db";
import { getErrorRates24h } from "@/lib/ops/errorRates";
import { getCronHeartbeatStatus, type MonitoredCron } from "@/lib/ops/cronHeartbeat";

export type DetectionSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface Detection {
  category: "cron_miss" | "migration_drift" | "error_spike" | "cost_cap_breach";
  detected: boolean;
  severity: DetectionSeverity;
  message: string;
  details: Record<string, unknown>;
}

/** Crons monitored for missed runs. Extend by adding a `recordCronHeartbeat`
 * call to a cron's route handler and listing it here. */
export const MONITORED_CRONS: MonitoredCron[] = [
  { name: "agents-tick", intervalMinutes: 10 },
  { name: "check-dlq", intervalMinutes: 15 },
  { name: "check-ai-budget", intervalMinutes: 60 },
];

export async function detectCronMisses(now: Date = new Date()): Promise<Detection> {
  const statuses = await getCronHeartbeatStatus(MONITORED_CRONS, now);
  const missed = statuses.filter((s) => s.missed);

  return {
    category: "cron_miss",
    detected: missed.length > 0,
    severity: missed.length > 1 ? "HIGH" : "MEDIUM",
    message:
      missed.length === 0
        ? "All monitored crons reported a heartbeat within their expected window."
        : `${missed.length} monitored cron(s) missed their expected heartbeat: ${missed.map((m) => m.name).join(", ")}.`,
    details: { statuses },
  };
}

export async function detectMigrationDrift(): Promise<Detection> {
  try {
    const rows = await prisma.$queryRaw<Array<{ pending: bigint }>>`
      SELECT COUNT(*) AS pending
      FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `;
    const raw = rows?.[0]?.pending;
    const pending = raw === null || raw === undefined ? 0 : Number(raw);

    return {
      category: "migration_drift",
      detected: pending > 0,
      severity: "HIGH", // schema state - always the high-caution category
      message: pending > 0 ? `${pending} migration(s) recorded as pending (not finished, not rolled back).` : "No pending migrations.",
      details: { pending },
    };
  } catch (error) {
    return {
      category: "migration_drift",
      detected: true,
      severity: "HIGH",
      message: "Could not query _prisma_migrations - treating as a detection rather than failing open.",
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/** Default error-spike threshold: env-configurable, no magic number hidden. */
const ERROR_SPIKE_THRESHOLD = Number(process.env.OPS_SENTINEL_ERROR_SPIKE_THRESHOLD ?? 50);

export async function detectErrorSpike(): Promise<Detection> {
  const summary = await getErrorRates24h();
  const detected = summary.totalErrors24h >= ERROR_SPIKE_THRESHOLD;

  return {
    category: "error_spike",
    detected,
    severity: summary.totalErrors24h >= ERROR_SPIKE_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
    message: detected
      ? `${summary.totalErrors24h} error-severity events in the last 24h (threshold ${ERROR_SPIKE_THRESHOLD}).`
      : `${summary.totalErrors24h} error-severity events in the last 24h - below threshold.`,
    details: { totalErrors24h: summary.totalErrors24h, topKinds: summary.topKinds, threshold: ERROR_SPIKE_THRESHOLD },
  };
}

const COST_CAP_BREACH_THRESHOLD = Number(process.env.OPS_SENTINEL_COST_CAP_THRESHOLD ?? 5);

export async function detectCostCapBreaches(now: Date = new Date()): Promise<Detection> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const count = await prisma.agentInvocation.count({
    where: { status: "COST_CAPPED", createdAt: { gte: since } },
  });
  const detected = count >= COST_CAP_BREACH_THRESHOLD;

  return {
    category: "cost_cap_breach",
    detected,
    severity: count >= COST_CAP_BREACH_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
    message: detected
      ? `${count} agent invocation(s) hit a cost cap in the last 24h (threshold ${COST_CAP_BREACH_THRESHOLD}).`
      : `${count} agent invocation(s) hit a cost cap in the last 24h - below threshold.`,
    details: { count, threshold: COST_CAP_BREACH_THRESHOLD, sinceIso: since.toISOString() },
  };
}

export async function runAllDetectors(now: Date = new Date()): Promise<Detection[]> {
  return Promise.all([detectCronMisses(now), detectMigrationDrift(), detectErrorSpike(), detectCostCapBreaches(now)]);
}
