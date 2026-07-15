/**
 * Cron heartbeat tracking for Ops Sentinel's cron-miss detector
 * (docs/agents/OPS_SENTINEL.md). Reuses the existing MetricEvent table
 * (same convention as lib/ops/errorRates.ts, lib/metrics/events.ts) rather
 * than a new one - one more event name, not a new system.
 *
 * A monitored cron calls `recordCronHeartbeat(name)` once it completes
 * successfully. `getCronHeartbeatStatus` compares the most recent
 * heartbeat per monitored cron against its expected interval (with a grace
 * multiplier) to flag a miss.
 */
import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";

const HEARTBEAT_EVENT_NAME = "cron.heartbeat";

export async function recordCronHeartbeat(cronName: string): Promise<void> {
  await recordMetricEvent(
    HEARTBEAT_EVENT_NAME,
    { cronName },
    { scope: "national", scopeId: null, severity: "info", kind: "counter" }
  );
}

export interface MonitoredCron {
  name: string;
  /** Expected interval between successful runs, in minutes. */
  intervalMinutes: number;
}

export interface CronHeartbeatStatus {
  name: string;
  lastHeartbeatAt: Date | null;
  minutesSinceLastHeartbeat: number | null;
  /** true once minutesSinceLastHeartbeat exceeds intervalMinutes * gracePeriodMultiplier. */
  missed: boolean;
}

const GRACE_PERIOD_MULTIPLIER = 2;

export async function getCronHeartbeatStatus(
  monitored: MonitoredCron[],
  now: Date = new Date()
): Promise<CronHeartbeatStatus[]> {
  return Promise.all(
    monitored.map(async (cron) => {
      const latest = await prisma.metricEvent.findFirst({
        where: { name: HEARTBEAT_EVENT_NAME, payloadJson: { path: ["cronName"], equals: cron.name } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (!latest) {
        return { name: cron.name, lastHeartbeatAt: null, minutesSinceLastHeartbeat: null, missed: true };
      }

      const minutesSince = (now.getTime() - latest.createdAt.getTime()) / 60_000;
      return {
        name: cron.name,
        lastHeartbeatAt: latest.createdAt,
        minutesSinceLastHeartbeat: minutesSince,
        missed: minutesSince > cron.intervalMinutes * GRACE_PERIOD_MULTIPLIER,
      };
    })
  );
}
