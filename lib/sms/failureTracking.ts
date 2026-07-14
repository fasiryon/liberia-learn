/**
 * Orange Liberia fallback behavior - APPROVED 2026-07-14, Option A
 * (alert and stop, no auto-fallback to another provider).
 * docs/agents/ORANGE_LIBERIA_FALLBACK_BEHAVIOR.md.
 *
 * Every failed SMS send gets a metric event (always-on, cheap, reuses the
 * existing MetricEvent "sms.failed" convention - not a new table). When the
 * SAME provider racks up 3 failures within a rolling 60-minute window, a
 * MEDIUM EscalationQueue entry fires once per cluster: the check only fires
 * exactly when the count crosses the threshold (not on every failure past
 * it), so a sustained outage doesn't spam the queue with one entry per
 * message. Applies to every provider (not just Orange) - "to the same
 * provider" scopes the count, it doesn't scope the mechanism to one
 * provider by name.
 */
import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import { enqueueEscalation } from "@/lib/agents/escalation";
import type { ReportScope } from "@/lib/reporting/scope";

const CLUSTER_WINDOW_MS = 60 * 60 * 1000;
const CLUSTER_THRESHOLD = 3;

export async function recordSmsSendFailure(
  providerName: string,
  scope: { scope: ReportScope; scopeId: string | null; schoolId?: string | null; userId?: string | null },
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await recordMetricEvent(
    "sms.failed",
    { provider: providerName, ...extraPayload },
    {
      scope: scope.scope,
      scopeId: scope.scopeId,
      schoolId: scope.schoolId ?? null,
      userId: scope.userId ?? null,
      severity: "error",
      kind: "counter",
    }
  );

  const windowStart = new Date(Date.now() - CLUSTER_WINDOW_MS);
  const recentFailures = await prisma.metricEvent.findMany({
    where: { name: "sms.failed", createdAt: { gte: windowStart } },
    select: { payloadJson: true },
  });
  const countForProvider = recentFailures.filter(
    (e) => (e.payloadJson as { provider?: string } | null)?.provider === providerName
  ).length;

  if (countForProvider === CLUSTER_THRESHOLD) {
    await enqueueEscalation({
      agentName: "sms-delivery-monitor",
      invocationId: null,
      reason: `SMS provider "${providerName}" had ${CLUSTER_THRESHOLD} failed sends within the last 60 minutes.`,
      priority: "MEDIUM",
    });
  }
}
