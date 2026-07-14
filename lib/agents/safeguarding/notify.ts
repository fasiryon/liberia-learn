/**
 * Sprint 6.1 Spec 5, Gate D: notify the school on a safeguarding escalation.
 * "The school" = ADMIN-role users at the school (principal proxy - there is
 * no PRINCIPAL Role in the schema) plus School.designatedSafetyStaffUserId
 * (Gate A), deduplicated. Uses existing infrastructure only (inbox +
 * push), per the instruction not to build new delivery channels.
 */
import { prisma } from "@/lib/db";
import { createInboxNotification } from "@/lib/notifications/inboxService";
import { sendPushToUser } from "@/lib/push/sendPush";
import { logger } from "@/lib/logger";

export async function notifySchoolSafeguarding(schoolId: string, reason: string): Promise<{ notifiedUserIds: string[] }> {
  const [admins, school] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN", schoolId }, select: { id: true } }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { designatedSafetyStaffUserId: true } }),
  ]);

  const userIds = new Set(admins.map((a) => a.id));
  if (school?.designatedSafetyStaffUserId) userIds.add(school.designatedSafetyStaffUserId);

  const title = "Safeguarding concern - immediate attention needed";
  const body = reason.length > 200 ? reason.slice(0, 197) + "..." : reason;

  await Promise.all(
    [...userIds].map(async (userId) => {
      await createInboxNotification(userId, { title, body, type: "safeguarding" });
      try {
        await sendPushToUser(userId, { title, body, url: "/admin/escalations" });
      } catch (err) {
        logger.warn("[safeguarding.notify] push failed, inbox notification still recorded", {
          userId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  if (userIds.size === 0) {
    logger.warn("[safeguarding.notify] no ADMIN or designated safety staff found for school", { schoolId });
  }

  return { notifiedUserIds: [...userIds] };
}
