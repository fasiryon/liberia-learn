/**
 * lib/training/progress.ts
 *
 * DB-backed progress helpers for the Training Center.
 *
 * Progress is scoped by teacherUserId which foreign-keys to User.
 * User has a schoolId — this is the tenant isolation boundary.
 * No separate schoolId column is needed on TrainingProgress because
 * the User → School join already provides it.
 *
 * Note: TrainingProgress.id has no @default in the schema, so we
 * generate IDs using Node's crypto.randomUUID().  updatedAt also has
 * no @updatedAt directive, so we set it explicitly on every write.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { MODULES_BY_LEVEL } from "@/lib/training/modules";

export type ModuleProgressRecord = {
  moduleId: string;
  status: "not_started" | "in_progress" | "complete";
  startedAt: Date | null;
  completedAt: Date | null;
};

// ─── Single-teacher helpers ──────────────────────────────────────────────────

/**
 * Return all training progress records for a teacher.
 * Tenant isolation: teacherUserId FK → User.schoolId ensures records
 * cannot span schools without an additional cross-tenant query.
 */
export async function getTeacherProgress(
  teacherUserId: string
): Promise<ModuleProgressRecord[]> {
  const records = await prisma.trainingProgress.findMany({
    where: { teacherUserId },
    select: { moduleId: true, status: true, startedAt: true, completedAt: true },
  });

  return records.map((r) => ({
    moduleId: r.moduleId,
    status: r.status as "not_started" | "in_progress" | "complete",
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));
}

/**
 * Mark a module as opened / in-progress.
 * Will NOT downgrade a module that is already "complete".
 */
export async function markModuleStarted(
  teacherUserId: string,
  moduleId: string
): Promise<void> {
  const existing = await prisma.trainingProgress.findUnique({
    where: { teacherUserId_moduleId: { teacherUserId, moduleId } },
    select: { status: true },
  });

  if (!existing) {
    await prisma.trainingProgress.create({
      data: {
        id: randomUUID(),
        teacherUserId,
        moduleId,
        status: "in_progress",
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return;
  }

  // Downgrade guard: only advance from not_started → in_progress
  if (existing.status === "not_started") {
    await prisma.trainingProgress.update({
      where: { teacherUserId_moduleId: { teacherUserId, moduleId } },
      data: { status: "in_progress", startedAt: new Date(), updatedAt: new Date() },
    });
  }
  // in_progress or complete: no change needed
}

/**
 * Mark a module as complete (upsert — idempotent).
 * Always sets completedAt to now, even if re-completing.
 */
export async function markModuleComplete(
  teacherUserId: string,
  moduleId: string
): Promise<void> {
  await prisma.trainingProgress.upsert({
    where: { teacherUserId_moduleId: { teacherUserId, moduleId } },
    create: {
      id: randomUUID(),
      teacherUserId,
      moduleId,
      status: "complete",
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      status: "complete",
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ─── School-level adoption stats ─────────────────────────────────────────────

export type AdoptionStats = {
  totalTeachers: number;
  level1Complete: number;
  level2Complete: number;
  level3Complete: number;
};

/**
 * Compute school-wide training adoption stats.
 * Tenant-scoped by schoolId.  Never exposes individual PII — counts only.
 */
export async function getSchoolAdoptionStats(schoolId: string): Promise<AdoptionStats> {
  const totalTeachers = await prisma.user.count({
    where: { schoolId, role: "TEACHER" },
  });

  if (totalTeachers === 0) {
    return { totalTeachers: 0, level1Complete: 0, level2Complete: 0, level3Complete: 0 };
  }

  const teachers = await prisma.user.findMany({
    where: { schoolId, role: "TEACHER" },
    select: { id: true },
  });
  const teacherIds = teachers.map((t) => t.id);

  const completedProgress = await prisma.trainingProgress.findMany({
    where: { teacherUserId: { in: teacherIds }, status: "complete" },
    select: { teacherUserId: true, moduleId: true },
  });

  function countLevelComplete(level: 1 | 2 | 3): number {
    const levelModuleIds = new Set(MODULES_BY_LEVEL[level].map((m) => m.id));
    return teacherIds.filter((tid) => {
      const done = new Set(
        completedProgress.filter((p) => p.teacherUserId === tid).map((p) => p.moduleId)
      );
      for (const mId of levelModuleIds) {
        if (!done.has(mId)) return false;
      }
      return true;
    }).length;
  }

  return {
    totalTeachers,
    level1Complete: countLevelComplete(1),
    level2Complete: countLevelComplete(2),
    level3Complete: countLevelComplete(3),
  };
}
