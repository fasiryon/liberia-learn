import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";

const STALE_HOURS = 72;

/**
 * After 72 hours without teacher review, AI feedback is released to the student as PROVISIONAL
 * feedback. LL-AEP-001: there is no automatic official AI grading. This job never writes the
 * official `score`, `feedback` or `gradedAt`, and the AI grade (`aiGrade`) is never shown to the
 * student as a score. The submission stays in the teacher's review queue until a teacher approves
 * or overrides it; only that teacher action sets the official score.
 *
 * `autoReleasedAt` now means "provisional AI feedback released", not "graded".
 */
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
  let released = 0;

  await Promise.all(
    stale.map(async (sub) => {
      // Conditional claim: only a still-unreviewed submission is marked, and no official field is written.
      const claimed = await prisma.assignmentSubmission.updateMany({
        where: { id: sub.id, teacherApproved: false, autoReleasedAt: null },
        data: { autoReleasedAt: now },
      });
      if (claimed.count === 0) return;
      released += 1;

      logAudit({
        userId: null,
        schoolId: sub.Assignment.Class.schoolId,
        action: "homework.ai_feedback_released_provisional",
        resourceType: "assignment_submission",
        resourceId: sub.id,
        details: {
          assignmentId: sub.Assignment.id,
          official: false,
          teacherReviewPending: true,
          releasedAt: now.toISOString(),
        },
      });

      sendPushToUser(sub.Student.user.id, {
        title: "Feedback ready",
        body: `AI feedback on ${sub.Assignment.title} is ready. Your teacher will confirm your grade.`,
        url: `/student/assignments/${sub.assignmentId}`,
      }).catch(() => null);
    }),
  );

  return { released };
}
