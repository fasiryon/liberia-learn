/**
 * NR-9.5: SLA-miss escalation for safeguarding EscalationQueue items.
 *
 * The first alert (inbox + push, lib/agents/safeguarding/notify.ts) already
 * fires immediately on creation. This closes the gap Sprint 6.1's own doc
 * named and left open: "what happens on an SLA miss... nothing alerts on
 * one yet" (docs/agents/GUARDIAN_SAFEGUARDING.md).
 *
 * Two-tier ladder, both idempotent per escalation id via an AuditLog marker
 * (no schema change - EscalationQueue gets no new column, following the
 * same side-channel pattern lib/agents/admin/escalations.ts already uses
 * for school-scoping instead of a schoolId column):
 *   - 4h open, school hours: re-fire the same school-level alert (inbox +
 *     push) as a nudge.
 *   - 24h open, any time: also alert the platform-level fallback contact
 *     by email (lib/agents/safeguarding/notify.ts's
 *     notifyPlatformSafeguardingFallback), since a HIGH safeguarding item
 *     open a full day is a serious operational failure that should not stay
 *     silent just because the school-level contact is unresponsive.
 *
 * A real production check (2026-07-30) found two HIGH items open 385 hours
 * with zero escalation of any kind - this is not a hypothetical gap.
 */
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifySchoolSafeguarding, notifyPlatformSafeguardingFallback } from "@/lib/agents/safeguarding/notify";
import { logger } from "@/lib/logger";

const FOUR_HOUR_ACTION = "agent.escalation.sla_alert_4h";
const TWENTY_FOUR_HOUR_ACTION = "agent.escalation.sla_alert_24h";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface SlaCheckResult {
  checked: number;
  fourHourAlertsSent: number;
  twentyFourHourAlertsSent: number;
  errors: Array<{ escalationId: string; message: string }>;
}

async function alreadyAlerted(action: string, escalationId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: { resourceType: "EscalationQueue", resourceId: escalationId, action },
    select: { id: true },
  });
  return existing !== null;
}

async function resolveSchoolId(escalationId: string): Promise<string | null> {
  const audit = await prisma.auditLog.findFirst({
    where: { resourceType: "EscalationQueue", resourceId: escalationId, action: "agent.escalation" },
    select: { schoolId: true },
  });
  return audit?.schoolId ?? null;
}

export async function runSafeguardingSlaCheck(): Promise<SlaCheckResult> {
  const now = Date.now();
  const openEscalations = await prisma.escalationQueue.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      priority: "HIGH",
      reason: { contains: "safeguarding", mode: "insensitive" },
    },
    select: { id: true, reason: true, createdAt: true },
  });

  const result: SlaCheckResult = {
    checked: openEscalations.length,
    fourHourAlertsSent: 0,
    twentyFourHourAlertsSent: 0,
    errors: [],
  };

  for (const escalation of openEscalations) {
    try {
      const ageMs = now - escalation.createdAt.getTime();
      const schoolId = await resolveSchoolId(escalation.id);

      if (ageMs >= FOUR_HOURS_MS && !(await alreadyAlerted(FOUR_HOUR_ACTION, escalation.id))) {
        if (schoolId) {
          await notifySchoolSafeguarding(
            schoolId,
            `SLA reminder: safeguarding escalation ${escalation.id} has been open for over 4 hours. ${escalation.reason}`
          );
        } else {
          logger.warn("[safeguarding.slaCheck] no schoolId resolved for 4h alert, cannot re-notify school", {
            escalationId: escalation.id,
          });
        }
        await logAudit({
          userId: null,
          action: FOUR_HOUR_ACTION,
          resourceType: "EscalationQueue",
          resourceId: escalation.id,
          schoolId,
          details: { ageHours: Math.round(ageMs / 3600000) },
        });
        result.fourHourAlertsSent += 1;
      }

      if (ageMs >= TWENTY_FOUR_HOURS_MS && !(await alreadyAlerted(TWENTY_FOUR_HOUR_ACTION, escalation.id))) {
        await notifyPlatformSafeguardingFallback(
          `Safeguarding escalation ${escalation.id} has been open for over 24 hours without resolution. ${escalation.reason}`
        );
        if (schoolId) {
          await notifySchoolSafeguarding(
            schoolId,
            `URGENT SLA breach: safeguarding escalation ${escalation.id} has been open for over 24 hours. ${escalation.reason}`
          );
        }
        await logAudit({
          userId: null,
          action: TWENTY_FOUR_HOUR_ACTION,
          resourceType: "EscalationQueue",
          resourceId: escalation.id,
          schoolId,
          details: { ageHours: Math.round(ageMs / 3600000) },
        });
        result.twentyFourHourAlertsSent += 1;
      }
    } catch (err) {
      result.errors.push({
        escalationId: escalation.id,
        message: err instanceof Error ? err.message : String(err),
      });
      logger.error("[safeguarding.slaCheck] failed to process escalation", {
        escalationId: escalation.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
