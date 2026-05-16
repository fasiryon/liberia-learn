import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";

const STALE_HOURS = 72;

export async function releaseStaleAIGrades(): Promise<{ released: number }> {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const stale = await prisma.assignmentSubmission.findMany({
    where: {
      aiGrade: { not: null },
      teacherApproved: false,
      autoReleasedAt: null,
      aiGradedAt: { lt: cutoff },
    },
    include: {
      Assignment: { select: { id: true, title: true, classId: true, Class: { select: { schoolId: true } } } },
      Student: { select: { id: true, user: { select: { id: true } } } },
    },
  });

  if (stale.length === 0) return { released: 0 };

  const now = new Date();

  await Promise.all(
    stale.map(async (sub) => {
      await prisma.assignmentSubmission.update({
        where: { id: sub.id },
        data: {
          score: sub.aiGrade!,
          feedback: sub.aiFeedback ?? undefined,
          gradedAt: now,
          autoReleasedAt: now,
        },
      });

      logAudit({
        userId: null,
        schoolId: sub.Assignment.Class.schoolId,
        action: "homework.ai_grade_auto_released",
        resourceType: "assignment_submission",
        resourceId: sub.id,
        details: {
          assignmentId: sub.Assignment.id,
          aiGrade: sub.aiGrade,
          autoReleasedAt: now.toISOString(),
        },
      });

      sendPushToUser(sub.Student.user.id, {
        title: "Assignment Graded",
        body: `Your ${sub.Assignment.title} has been graded. Score: ${sub.aiGrade}/100`,
        url: `/student/assignments/${sub.assignmentId}`,
      }).catch(() => null);
    }),
  );

  return { released: stale.length };
}
