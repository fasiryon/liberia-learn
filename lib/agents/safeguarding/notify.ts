/**
 * Sprint 6.1 Spec 5, Gate D: notify the school on a safeguarding escalation.
 * "The school" = ADMIN-role users at the school (principal proxy - there is
 * no PRINCIPAL Role in the schema) plus School.designatedSafetyStaffUserId
 * (Gate A), deduplicated. Uses existing infrastructure only (inbox +
 * push), per the instruction not to build new delivery channels.
 *
 * NR-9.5: a real production check (2026-07-30) found 17/23 schools have
 * neither an ADMIN nor a designatedSafetyStaffUserId - the userIds.size===0
 * branch below is not hypothetical. It now also alerts a platform-level
 * fallback contact by email so a real human is reachable even when a school
 * has nobody assigned, rather than only a swallowed warning log.
 */
import { prisma } from "@/lib/db";
import { createInboxNotification } from "@/lib/notifications/inboxService";
import { sendPushToUser } from "@/lib/push/sendPush";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export type PlatformSafeguardingDelivery = {
  ok: boolean;
  skipped?: true;
  error?: string;
};

export type SchoolSafeguardingDelivery = {
  notifiedUserIds: string[];
  intendedUserIds: string[];
  pushDeliveredUserIds: string[];
  fallback: PlatformSafeguardingDelivery | null;
  delivered: boolean;
  failures: Array<{ channel: "inbox" | "push"; userId: string; error: string }>;
};

/**
 * Email the platform-level safeguarding fallback contact
 * (PLATFORM_SAFEGUARDING_ESCALATION_EMAIL). Used when a school has nobody to
 * notify at all, and by the SLA-miss checker's 24h escalation tier. Returns
 * null (not an error) when the env var is unset, logging a warning so the
 * gap stays visible rather than silently failing.
 */
export async function notifyPlatformSafeguardingFallback(
  reason: string
): Promise<PlatformSafeguardingDelivery> {
  const to = process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL?.trim();
  if (!to) {
    logger.warn("[safeguarding.notify] PLATFORM_SAFEGUARDING_ESCALATION_EMAIL not set, cannot alert platform fallback", {
      reason,
    });
    return {
      ok: false,
      skipped: true,
      error: "fallback_email_not_configured",
    };
  }

  const subject = "Safeguarding escalation needs attention";
  const text = `A safeguarding escalation needs attention and could not be (or was not) resolved through the normal school-level channel.\n\nReason: ${reason}\n\nReview: ${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/admin/escalations`;
  const result = await sendEmail({
    to,
    subject,
    html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
    text,
    type: "safeguarding_platform_fallback",
    recipientRole: "platform_admin",
    transactional: true,
  });

  if (!result.ok) {
    logger.error("[safeguarding.notify] platform fallback email failed to send", {
      reason,
      error: result.error,
    });
  }

  return {
    ok: result.ok,
    ...(result.ok ? {} : { error: result.error ?? "fallback_email_failed" }),
  };
}

export async function notifySchoolSafeguarding(
  schoolId: string,
  reason: string
): Promise<SchoolSafeguardingDelivery> {
  const [admins, school] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN", schoolId }, select: { id: true } }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { designatedSafetyStaffUserId: true } }),
  ]);

  const userIds = new Set(admins.map((a) => a.id));
  if (school?.designatedSafetyStaffUserId) userIds.add(school.designatedSafetyStaffUserId);

  const title = "Safeguarding concern - immediate attention needed";
  const body = reason.length > 200 ? reason.slice(0, 197) + "..." : reason;

  const intendedUserIds = [...userIds];
  const notifiedUserIds: string[] = [];
  const pushDeliveredUserIds: string[] = [];
  const failures: SchoolSafeguardingDelivery["failures"] = [];

  await Promise.all(
    intendedUserIds.map(async (userId) => {
      try {
        await createInboxNotification(userId, { title, body, type: "safeguarding" });
        notifiedUserIds.push(userId);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failures.push({ channel: "inbox", userId, error });
        logger.error("[safeguarding.notify] inbox delivery failed", {
          userId,
          message: error,
        });
        return;
      }

      try {
        await sendPushToUser(userId, { title, body, url: "/admin/escalations" });
        pushDeliveredUserIds.push(userId);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failures.push({ channel: "push", userId, error });
        logger.warn("[safeguarding.notify] push failed, inbox notification still recorded", {
          userId,
          message: error,
        });
      }
    })
  );

  let fallback: PlatformSafeguardingDelivery | null = null;
  if (userIds.size === 0) {
    logger.warn("[safeguarding.notify] no ADMIN or designated safety staff found for school", { schoolId });
    fallback = await notifyPlatformSafeguardingFallback(
      `School ${schoolId} has no ADMIN and no designated safety staff to receive a safeguarding alert. ${reason}`
    );
  }

  return {
    notifiedUserIds,
    intendedUserIds,
    pushDeliveredUserIds,
    fallback,
    delivered: notifiedUserIds.length > 0 || fallback?.ok === true,
    failures,
  };
}
