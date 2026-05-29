/**
 * lib/adaptive/routeStuck.ts  — NR-14B Phase 2
 *
 * Decides where to send a stuck student. Priority:
 *   1. scaffold/simplified LessonVariant → "scaffold"
 *   2. required/recommended prerequisite not yet mastered → "prerequisite"
 *   3. fallback (always available) → "ai_tutor"
 *
 * Note: scaffold variants won't exist for most lessons in the first pass
 * (NR-14B-ii will generate them from StuckEvent data). Routing will
 * skip to prerequisite → ai_tutor until scaffold variants are populated.
 */

import { prisma } from "@/lib/db";

export type StuckRoute =
  | { to: "scaffold"; variantId: string }
  | { to: "prerequisite"; lessonId: string }
  | { to: "ai_tutor" };

/**
 * Derive the NR-14B skillKey from a CurriculumContent row.
 * Format: "SUBJECT:GN:unitId"  (unitId falls back to contentId)
 */
export async function lessonSkillKey(lessonId: string): Promise<string> {
  const content = await prisma.curriculumContent.findUnique({
    where: { id: lessonId },
    select: { subject: true, grade: true, unitId: true, contentId: true },
  });
  if (!content) return `UNKNOWN:G0:${lessonId}`;
  const unit = content.unitId ?? content.contentId;
  return `${content.subject}:G${content.grade}:${unit}`;
}

/**
 * Route a stuck student to the most helpful intervention.
 */
export async function routeStuck(input: {
  studentId: string;
  lessonId: string; // CurriculumContent.id
}): Promise<StuckRoute> {
  const { studentId, lessonId } = input;

  // 1. Does a scaffold/simplified variant exist?
  const variant = await prisma.lessonVariant.findFirst({
    where: {
      lessonId,
      variantType: { in: ["scaffold", "simplified"] },
    },
    select: { id: true },
  });
  if (variant) {
    return { to: "scaffold", variantId: variant.id };
  }

  // 2. Are there required/recommended prerequisites the student hasn't mastered?
  const prereqs = await prisma.lessonPrerequisite.findMany({
    where: { lessonId },
    select: { prerequisiteLessonId: true, strength: true },
    orderBy: { strength: "asc" }, // "recommended" before "required" alphabetically — fine
  });

  // Check required first, then recommended
  const required = prereqs.filter((p) => p.strength === "required");
  const recommended = prereqs.filter((p) => p.strength === "recommended");
  const ordered = [...required, ...recommended];

  for (const prereq of ordered) {
    const skillKey = await lessonSkillKey(prereq.prerequisiteLessonId);
    const mastery = await prisma.adaptiveMasteryRecord.findUnique({
      where: { studentId_skillKey: { studentId, skillKey } },
      select: { masteredAt: true },
    });
    if (!mastery?.masteredAt) {
      return { to: "prerequisite", lessonId: prereq.prerequisiteLessonId };
    }
  }

  // 3. Always-available fallback
  return { to: "ai_tutor" };
}
