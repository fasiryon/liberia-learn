import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendReliableSms } from "@/lib/sms/reliableSend";
import { logger } from "@/lib/logger";

type EventInput = {
  id: string;
  schoolId: string;
  title: string;
  eventDate: Date;
  type: string;
  sendSms: boolean;
};

const SMS_ELIGIBLE_TYPES = ["EXAM", "MEETING"];

export async function scheduleEventSmsReminders(event: EventInput): Promise<void> {
  if (!event.sendSms) return;
  if (!SMS_ELIGIBLE_TYPES.includes(event.type)) return;

  const reminderAt = new Date(event.eventDate.getTime() - 24 * 60 * 60 * 1000);
  if (reminderAt <= new Date()) {
    logger.info("[eventSmsScheduler] Skipping past reminder", {
      eventId: event.id,
      reminderAt: reminderAt.toISOString(),
    });
    return;
  }

  try {
    const school = await prisma.school.findUnique({
      where: { id: event.schoolId },
      select: { name: true },
    });
    const schoolName = school?.name ?? "your school";

    const guardians = await prisma.user.findMany({
      where: {
        role: "GUARDIAN",
        guardianOf: {
          some: {
            student: {
              enrollments: {
                some: {
                  Class: { schoolId: event.schoolId },
                },
              },
            },
          },
        },
      },
      select: { id: true, guardianPhoneE164: true },
    });

    const dateStr = event.eventDate.toLocaleDateString("en-LR", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const message = `Reminder: ${event.title} at ${schoolName} on ${dateStr}. — LiberiaLearn`;

    let dispatched = 0;
    for (const guardian of guardians) {
      if (!guardian.guardianPhoneE164) continue;
      void sendReliableSms(guardian.guardianPhoneE164, message).catch((err) => {
        logger.warn("[eventSmsScheduler] SMS send failed", {
          guardianId: guardian.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      dispatched += 1;
    }

    await prisma.schoolEvent.update({
      where: { id: event.id },
      data: { smsScheduledAt: new Date() },
    });

    void logAudit({
      userId: null,
      action: "event.sms_scheduled",
      resourceType: "SchoolEvent",
      resourceId: event.id,
      schoolId: event.schoolId,
      details: {
        eventTitle: event.title,
        eventType: event.type,
        reminderAt: reminderAt.toISOString(),
        guardiansQueued: dispatched,
      },
    });
  } catch (err) {
    logger.error("[eventSmsScheduler] Failed to schedule SMS reminders", {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
