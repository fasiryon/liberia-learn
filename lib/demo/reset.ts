import type { PrismaClient } from "@prisma/client";
import { SCHOOL_DEFS, seedNationalDemo } from "@/scripts/seed-demo";
import { isProduction, isStaging } from "@/lib/environment";

export function getDemoSchoolIdsFromEnv(): string[] {
  return (process.env.DEMO_SCHOOL_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isLiveDemoResetEnabled(): boolean {
  return process.env.ALLOW_LIVE_DEMO_RESET === "true";
}

export function canRunDemoResetInCurrentEnv(): boolean {
  if (isProduction() || isStaging()) {
    return isLiveDemoResetEnabled();
  }
  return true;
}

export function validateDemoSchoolIds(schoolIds: string[]): string[] {
  const validSchoolIds = new Set<string>(SCHOOL_DEFS.map((school) => school.id));
  return schoolIds.filter((schoolId) => !validSchoolIds.has(schoolId));
}

export async function resetDemoSchools(params: {
  prisma: PrismaClient;
  schoolIds: string[];
}): Promise<void> {
  const { prisma, schoolIds } = params;

  const demoStudents = await prisma.student.findMany({
    where: {
      user: {
        schoolId: { in: schoolIds },
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  const studentIds = demoStudents.map((student) => student.id);
  const userIds = demoStudents.map((student) => student.userId);

  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({
      where: {
        Meeting: {
          is: {
            Class: {
              is: {
                schoolId: { in: schoolIds },
              },
            },
          },
        },
      },
    }),
    prisma.studentProgress.deleteMany({
      where: {
        studentId: { in: userIds.length ? userIds : ["__none__"] },
      },
    }),
    prisma.homeworkSubmission.deleteMany({
      where: {
        studentId: { in: studentIds.length ? studentIds : ["__none__"] },
      },
    }),
    prisma.placementTest.deleteMany({
      where: {
        studentId: { in: studentIds.length ? studentIds : ["__none__"] },
      },
    }),
    prisma.labSession.deleteMany({
      where: {
        schoolId: { in: schoolIds },
      },
    }),
    prisma.guardianMessage.deleteMany({
      where: {
        schoolId: { in: schoolIds },
      },
    }),
    prisma.sMSDeliveryLog.deleteMany({
      where: {
        schoolId: { in: schoolIds },
      },
    }),
    prisma.notificationLog.deleteMany({
      where: {
        user: {
          schoolId: { in: schoolIds },
        },
      },
    }),
    prisma.auditLog.deleteMany({
      where: {
        schoolId: { in: schoolIds },
      },
    }),
    prisma.scheduledWork.deleteMany({
      where: {
        class: {
          schoolId: { in: schoolIds },
        },
      },
    }),
  ]);

  await seedNationalDemo({
    prisma,
    schoolIds,
    allowExisting: true,
    allowProduction: isProduction() || isStaging(),
  });
}
