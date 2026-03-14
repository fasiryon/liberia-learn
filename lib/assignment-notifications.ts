import { prisma } from "@/lib/db";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";

async function recordNotification(input: {
  userId: string;
  recipient: string;
  body: string;
  status: string;
  error?: string | null;
}) {
  await prisma.notificationLog.create({
    data: {
      userId: input.userId,
      channel: "sms",
      recipient: input.recipient,
      body: input.body,
      status: input.status,
      error: input.error ?? null,
    },
  });
}

export async function notifyAssignmentSubmitted(input: {
  actorUserId: string;
  schoolId: string;
  schoolName: string;
  studentId: string;
  studentName: string;
  assignmentTitle: string;
}) {
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

  const body = `LiberiaLearn: ${input.studentName} submitted ${input.assignmentTitle} at ${input.schoolName}.`;
  await Promise.all(
    student.guardians.map(async (guardian) => {
      try {
        const result = await sendGuardianSMS({
          schoolId: input.schoolId,
          studentId: input.studentId,
          guardianId: guardian.guardianId,
          messageType: "custom",
          payload: {
            message: body,
            studentName: input.studentName,
            assignmentTitle: input.assignmentTitle,
            schoolName: input.schoolName,
          },
          actorUserId: input.actorUserId,
          idempotencyKey: `assignment-submitted:${input.studentId}:${guardian.guardianId}:${input.assignmentTitle}`,
        });

        await recordNotification({
          userId: guardian.guardianId,
          recipient: guardian.guardianId,
          body,
          status: result.status,
          error: result.status === "failed" ? "assignment_submission_sms_failed" : null,
        });
      } catch (error: any) {
        await recordNotification({
          userId: guardian.guardianId,
          recipient: guardian.guardianId,
          body,
          status: "failed",
          error: error?.message ?? "assignment_submission_sms_failed",
        });
      }
    })
  );
}
