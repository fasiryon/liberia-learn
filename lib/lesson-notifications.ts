import { prisma } from "@/lib/db";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";

type NotifyLessonCompletionInput = {
  actingUserId: string;
  schoolId: string;
  schoolName: string;
  studentId: string;
  studentName: string;
  subject: string;
};

export async function notifyLessonCompletion(input: NotifyLessonCompletionInput) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: {
      guardians: {
        select: {
          guardianId: true,
        },
      },
    },
  });

  if (!student || student.guardians.length === 0) {
    return;
  }

  const message = `LiberiaLearn: ${input.studentName} completed ${input.subject} lesson today at ${input.schoolName}.`;

  await Promise.all(
    student.guardians.map(async (guardian) => {
      try {
        await sendGuardianSMS({
          schoolId: input.schoolId,
          studentId: input.studentId,
          guardianId: guardian.guardianId,
          messageType: "custom",
          payload: {
            message,
            studentName: input.studentName,
            subject: input.subject,
            schoolName: input.schoolName,
          },
          actorUserId: input.actingUserId,
          idempotencyKey: `lesson-complete:${input.studentId}:${guardian.guardianId}:${input.subject}`,
        });
      } catch (error: any) {
        await prisma.notificationLog.create({
          data: {
            userId: guardian.guardianId,
            channel: "sms",
            recipient: guardian.guardianId,
            body: message,
            status: "failed",
            error: error?.message ?? "lesson_completion_sms_failed",
          },
        });
      }
    })
  );
}
