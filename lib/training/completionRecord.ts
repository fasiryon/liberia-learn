import crypto from "crypto";
import { prisma } from "@/lib/db";
import { computeEarnedBadges } from "@/lib/training/badges";
import { TRAINING_MODULES } from "@/lib/training/modules";
import type { ModuleProgressRecord } from "@/lib/training/progress";

export const TRAINING_RECORD_NAME = "LiberiaLearn Training Completion Record";

export const TRAINING_RECORD_DISCLAIMER =
  "This record confirms completion of LiberiaLearn platform training modules. It reflects platform proficiency only and is not an official teacher license, Ministry of Education qualification, government-issued credential, or employment requirement.";

export type TrainingCompletionRecord = {
  teacherName: string;
  teacherEmail: string | null;
  schoolName: string;
  completed: boolean;
  completedModules: number;
  totalModules: number;
  completionDate: string | null;
  recordCode: string | null;
  badges: Array<{ name: string; label: string; level: 1 | 2 | 3 }>;
  modules: Array<{
    id: string;
    title: string;
    level: 1 | 2 | 3;
    status: "not_started" | "in_progress" | "complete";
    completedAt: string | null;
  }>;
};

function makeRecordCode(teacherUserId: string, completionDate: string | null): string {
  return crypto
    .createHash("sha256")
    .update(`training-record:${teacherUserId}:${completionDate ?? "incomplete"}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function normalizeProgress(records: Array<{
  moduleId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
}>): ModuleProgressRecord[] {
  return records.map((record) => ({
    moduleId: record.moduleId,
    status:
      record.status === "complete" || record.status === "in_progress"
        ? record.status
        : "not_started",
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  }));
}

export async function getTrainingCompletionRecord(
  teacherUserId: string
): Promise<TrainingCompletionRecord> {
  const [teacher, rawProgress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: teacherUserId },
      select: {
        name: true,
        email: true,
        school: { select: { name: true } },
      },
    }),
    prisma.trainingProgress.findMany({
      where: { teacherUserId },
      select: { moduleId: true, status: true, startedAt: true, completedAt: true },
    }),
  ]);

  const progress = normalizeProgress(rawProgress);
  const progressByModule = new Map(progress.map((entry) => [entry.moduleId, entry]));
  const modules = TRAINING_MODULES.map((module) => {
    const record = progressByModule.get(module.id);
    return {
      id: module.id,
      title: module.title,
      level: module.level,
      status: record?.status ?? "not_started",
      completedAt: record?.completedAt?.toISOString() ?? null,
    };
  });
  const completedModules = modules.filter((module) => module.status === "complete").length;
  const completed = completedModules === TRAINING_MODULES.length;
  const completedDates = modules
    .map((module) => module.completedAt)
    .filter((date): date is string => Boolean(date))
    .sort();
  const completionDate = completed ? completedDates[completedDates.length - 1] ?? null : null;

  return {
    teacherName: teacher?.name ?? "Teacher",
    teacherEmail: teacher?.email ?? null,
    schoolName: teacher?.school?.name ?? "LiberiaLearn school",
    completed,
    completedModules,
    totalModules: TRAINING_MODULES.length,
    completionDate,
    recordCode: completed ? makeRecordCode(teacherUserId, completionDate) : null,
    badges: computeEarnedBadges(progress).map((badge) => ({
      name: badge.name,
      label: badge.label,
      level: badge.level,
    })),
    modules,
  };
}
