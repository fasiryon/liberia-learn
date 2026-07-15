/**
 * Ops Sentinel sweep orchestrator (docs/agents/OPS_SENTINEL.md).
 *
 * Deterministic tier mapping per category - not left to LLM judgment, same
 * discipline as Sprint 6.1's safeguarding keyword gate. Only cron misses
 * have a provably-safe auto-fix (retrying a read-then-alert or
 * state-machine-advance cron once is not destructive); migration drift,
 * error spikes, and cost cap breaches all touch either schema state or a
 * business/config decision, so they are always proposed via
 * EscalationQueue, never auto-applied.
 */
import { runAllDetectors, type Detection } from "@/lib/agents/opsSentinel/detectors";
import { retryCron, proposeFix } from "@/lib/agents/opsSentinel/actions";

export interface SweepResultItem {
  category: Detection["category"];
  detected: boolean;
  tier: 1 | 2 | null;
  action: "none" | "auto_fixed" | "escalated";
  detail: string;
}

export interface SweepResult {
  ranAt: string;
  items: SweepResultItem[];
}

export async function runOpsSentinelSweep(now: Date = new Date()): Promise<SweepResult> {
  const detections = await runAllDetectors(now);
  const items: SweepResultItem[] = [];

  for (const detection of detections) {
    if (!detection.detected) {
      items.push({ category: detection.category, detected: false, tier: null, action: "none", detail: detection.message });
      continue;
    }

    if (detection.category === "cron_miss") {
      const missedCrons = (detection.details.statuses as Array<{ name: string; missed: boolean }>).filter((s) => s.missed);
      const retryResults = await Promise.all(missedCrons.map((c) => retryCron(c.name)));
      const allRetriedOk = retryResults.every((r) => r.ok);

      if (allRetriedOk) {
        items.push({
          category: "cron_miss",
          detected: true,
          tier: 1,
          action: "auto_fixed",
          detail: `Retried ${missedCrons.map((c) => c.name).join(", ")} - all succeeded.`,
        });
      } else {
        const { escalationId } = await proposeFix(detection);
        items.push({
          category: "cron_miss",
          detected: true,
          tier: 2,
          action: "escalated",
          detail: `Retry failed for at least one cron - escalated (${escalationId}).`,
        });
      }
      continue;
    }

    // migration_drift, error_spike, cost_cap_breach: always tier 2.
    const { escalationId } = await proposeFix(detection);
    items.push({
      category: detection.category,
      detected: true,
      tier: 2,
      action: "escalated",
      detail: `${detection.message} (escalation ${escalationId})`,
    });
  }

  return { ranAt: now.toISOString(), items };
}
