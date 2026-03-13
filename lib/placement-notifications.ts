import { prisma } from "@/lib/db";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import { placementConfirmationGuardian, placementConfirmationStudent } from "@/lib/notification-messages";
import { sendSMS } from "@/lib/sms";

type PlacementNotificationInput = {
  actingUserId: string;
  schoolId: string;
  schoolName: string;
  student: {
    id: string;
    userId: string;
    name: string | null;
    phone: string | null;
    guardians: Array<{
      guardianId: string;
      guardianName: string | null;
    }>;
  };
  finalGrade: number;
};

async function recordNotificationLog(input: {
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

export async function notifyPlacementConfirmation(input: PlacementNotificationInput) {
  const studentName = input.student.name?.trim() || "Your child";
  const schoolName = input.schoolName.trim() || "LiberiaLearn";
  const studentMessage = placementConfirmationStudent(schoolName, input.finalGrade);
  const guardianMessage = placementConfirmationGuardian(studentName, input.finalGrade);

  if (input.student.phone) {
    try {
      const result = await sendSMS(input.student.phone, studentMessage);
      await recordNotificationLog({
        userId: input.student.userId,
        recipient: input.student.phone,
        body: studentMessage,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error ?? "student_sms_failed",
      });
    } catch (error: any) {
      await recordNotificationLog({
        userId: input.student.userId,
        recipient: input.student.phone,
        body: studentMessage,
        status: "failed",
        error: error?.message ?? "student_sms_failed",
      });
    }
  }

  await Promise.all(
    input.student.guardians.map(async (guardian) => {
      try {
        const result = await sendGuardianSMS({
          schoolId: input.schoolId,
          studentId: input.student.id,
          guardianId: guardian.guardianId,
          messageType: "custom",
          payload: {
            message: guardianMessage,
            studentName,
          },
          actorUserId: input.actingUserId,
          idempotencyKey: `placement-confirmed:${input.student.id}:${guardian.guardianId}:${input.finalGrade}`,
        });

        await recordNotificationLog({
          userId: guardian.guardianId,
          recipient: guardian.guardianName ?? guardian.guardianId,
          body: guardianMessage,
          status: result.status === "sent" ? "sent" : result.status,
          error: result.status === "failed" ? "guardian_sms_failed" : null,
        });
      } catch (error: any) {
        await recordNotificationLog({
          userId: guardian.guardianId,
          recipient: guardian.guardianName ?? guardian.guardianId,
          body: guardianMessage,
          status: "failed",
          error: error?.message ?? "guardian_sms_failed",
        });
      }
    })
  );
}
