import { prisma } from "@/lib/db";

type AlertPrefs = {
  teacherId: string;
  alertLowGrade: boolean;
  alertInactive: boolean;
  alertNewSubmission: boolean;
  alertGuardianMessage: boolean;
  dailyDigest: boolean;
  digestHour: number;
};

const DEFAULT_PREFS = {
  alertLowGrade: true,
  alertInactive: true,
  alertNewSubmission: true,
  alertGuardianMessage: true,
  dailyDigest: false,
  digestHour: 7,
};

export async function getTeacherAlertPref(teacherId: string): Promise<AlertPrefs> {
  const pref = await prisma.teacherAlertPreference.findUnique({
    where: { teacherId },
    select: {
      teacherId: true,
      alertLowGrade: true,
      alertInactive: true,
      alertNewSubmission: true,
      alertGuardianMessage: true,
      dailyDigest: true,
      digestHour: true,
    },
  });
  return pref ?? { teacherId, ...DEFAULT_PREFS };
}
