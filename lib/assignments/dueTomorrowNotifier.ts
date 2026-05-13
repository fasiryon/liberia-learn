import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";
import { logger } from "@/lib/logger";

export async function notifyAssignmentsDueTomorrow(): Promise<{ notified: number; assignments: number }> {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const assignments = await prisma.assignment.findMany({
    where: {
      dueAt: { gte: tomorrowStart, lt: tomorrowEnd },
    },
    include: {
      Class: {
        include: {
          enrollments: {
            include: {
              Student: {
                include: {
                  user: { select: { id: true } },
                  guardians: {
                    include: { guardian: { select: { id: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let notified = 0;
  const notifiedUserIds = new Set<string>();

  for (const assignment of assignments) {
    const enrollments = assignment.Class.enrollments;

    for (const enrollment of enrollments) {
      const student = enrollment.Student;
      const studentUserId = student.user.id;
      const payload = {
        title: "Assignment Due Tomorrow",
        body: `${assignment.title} is due tomorrow`,
        url: `/student/assignments`,
      };

      // Notify student
      if (!notifiedUserIds.has(`student:${studentUserId}:${assignment.id}`)) {
        notifiedUserIds.add(`student:${studentUserId}:${assignment.id}`);
        sendPushToUser(studentUserId, payload).catch(() => null);
        notified++;
      }

      // Notify linked guardians
      for (const link of student.guardians) {
        const guardianUserId = link.guardian.id;
        const key = `guardian:${guardianUserId}:${assignment.id}`;
        if (!notifiedUserIds.has(key)) {
          notifiedUserIds.add(key);
          sendPushToUser(guardianUserId, payload).catch(() => null);
          notified++;
        }
      }
    }
  }

  logger.info("Assignment due-tomorrow notifier complete", { assignments: assignments.length, notified });
  return { notified, assignments: assignments.length };
}
