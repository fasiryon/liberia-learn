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

type StudentGuardianLookup = {
  guardians?: Array<{
    guardianId?: string | null;
  }> | null;
} | null;

function getGuardianIds(student: StudentGuardianLookup): string[] {
  if (!student?.guardians?.length) {
    return [];
  }

  return student.guardians
    .map((guardian) => guardian.guardianId?.trim())
    .filter((guardianId): guardianId is string => Boolean(guardianId));
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

  const guardianIds = getGuardianIds(student);
  if (guardianIds.length === 0) {
    return;
  }

  const body = `LiberiaLearn: ${input.studentName} submitted ${input.assignmentTitle} at ${input.schoolName}.`;
  await Promise.all(
    guardianIds.map(async (guardianId) => {
      try {
        const result = await sendGuardianSMS({
          schoolId: input.schoolId,
          studentId: input.studentId,
          guardianId,
          messageType: "custom",
          payload: {
            message: body,
            studentName: input.studentName,
            assignmentTitle: input.assignmentTitle,
            schoolName: input.schoolName,
          },
          actorUserId: input.actorUserId,
          idempotencyKey: `assignment-submitted:${input.studentId}:${guardianId}:${input.assignmentTitle}`,
        });

        await recordNotification({
          userId: guardianId,
          recipient: guardianId,
          body,
          status: result.status,
          error: result.status === "failed" ? "assignment_submission_sms_failed" : null,
        });
      } catch (error: any) {
        await recordNotification({
          userId: guardianId,
          recipient: guardianId,
          body,
          status: "failed",
          error: error?.message ?? "assignment_submission_sms_failed",
        });
      }
    })
  );
}

export async function notifyAssignmentCreated(input: {
  actorUserId: string;
  schoolId: string;
  classId: string;
  assignmentTitle: string;
  className: string;
  teacherName: string;
  dueAt?: Date | null;
}) {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: input.classId },
    select: {
      Student: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (enrollments.length === 0) {
    return;
  }

  const dueText = input.dueAt
    ? ` Due ${input.dueAt.toLocaleDateString("en-LR")}.`
    : "";
  const body = `Assigned by ${input.teacherName}: ${input.assignmentTitle} for ${input.className}.${dueText}`;

  await Promise.all(
    enrollments.map((row) =>
      prisma.notificationLog.create({
        data: {
          userId: row.Student.user.id,
          channel: "in_app",
          recipient: row.Student.user.email,
          subject: "New assignment",
          body,
          status: "delivered",
        },
      })
    )
  );
}

export async function notifyAssignmentGraded(input: {
  actorUserId: string;
  schoolId: string;
  schoolName: string;
  studentId: string;
  studentName: string;
  assignmentTitle: string;
  score: number;
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

  const guardianIds = getGuardianIds(student);
  if (guardianIds.length === 0) {
    return;
  }

  const body = `LiberiaLearn: ${input.studentName} received a grade of ${input.score}/100 on ${input.assignmentTitle}.`;
  await Promise.all(
    guardianIds.map(async (guardianId) => {
      try {
        const result = await sendGuardianSMS({
          schoolId: input.schoolId,
          studentId: input.studentId,
          guardianId,
          messageType: "custom",
          payload: {
            message: body,
            studentName: input.studentName,
            assignmentTitle: input.assignmentTitle,
            score: input.score,
            schoolName: input.schoolName,
          },
          actorUserId: input.actorUserId,
          idempotencyKey: `assignment-graded:${input.studentId}:${guardianId}:${input.assignmentTitle}:${input.score}`,
        });

        await recordNotification({
          userId: guardianId,
          recipient: guardianId,
          body,
          status: result.status,
          error: result.status === "failed" ? "assignment_grade_sms_failed" : null,
        });
      } catch (error: any) {
        await recordNotification({
          userId: guardianId,
          recipient: guardianId,
          body,
          status: "failed",
          error: error?.message ?? "assignment_grade_sms_failed",
        });
      }
    })
  );
}
