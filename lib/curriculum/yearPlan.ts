import { prisma } from "@/lib/db";

export const CURRICULUM_YEAR_TARGETS = {
  weeksPerGradeSubject: 36,
  lessonsPerWeek: 5,
  lessonsPerGradeSubject: 180,
} as const;

export type LessonForYearMapping = {
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  contentType: string;
  lessonType: string | null;
  payload: unknown;
  moeAlignments?: unknown;
  audioAssets?: unknown[];
  timetableAssignments?: unknown[];
};

export type YearReadinessRow = {
  grade: number;
  subject: string;
  totalLessons: number;
  mappedLessons: number;
  readinessPct: number;
  weeksCovered: number;
  unitsCovered: number;
  missingWeeks: number[];
  missingAssessments: number;
  missingTeacherGuides: number;
  missingWorksheets: number;
  missingAudio: number;
  missingLabs: number;
  classification: "CRITICAL" | "PARTIAL" | "STRONG";
};

function payloadTitle(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return typeof record.title === "string"
    ? record.title
    : typeof record.topic === "string"
      ? record.topic
      : null;
}

export function lessonTitle(lesson: Pick<LessonForYearMapping, "title" | "payload" | "contentId">) {
  return lesson.title ?? payloadTitle(lesson.payload) ?? lesson.contentId;
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !["lesson", "grade", "introduction", "understanding"].includes(word));
}

export function deriveUnitTheme(lessons: LessonForYearMapping[], fallbackIndex: number): string {
  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    for (const word of normalizedWords(lessonTitle(lesson))) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
  return best ? best[0].toUpperCase() + best.slice(1) : `Unit ${fallbackIndex}`;
}

export function inferLessonPlanType(lesson: Pick<LessonForYearMapping, "contentType" | "lessonType" | "payload" | "subject">) {
  const source = `${lesson.contentType} ${lesson.lessonType ?? ""} ${JSON.stringify(lesson.payload).slice(0, 500)}`.toLowerCase();
  if (source.includes("assessment") || source.includes("quiz") || source.includes("exit ticket")) return "ASSESSMENT" as const;
  if (source.includes("project")) return "PROJECT" as const;
  if (source.includes("lab") || (lesson.subject === "SCIENCE" && source.includes("experiment"))) return "LAB" as const;
  if (source.includes("review")) return "REVIEW" as const;
  return "CORE" as const;
}

export function classifyCoverage(totalLessons: number): YearReadinessRow["classification"] {
  if (totalLessons < 20) return "CRITICAL";
  if (totalLessons < 60) return "PARTIAL";
  return "STRONG";
}

export function buildDeterministicLessonOrder<T extends LessonForYearMapping>(lessons: T[]): T[] {
  return [...lessons].sort((left, right) => {
    if (left.grade !== right.grade) return left.grade - right.grade;
    const subjectCompare = left.subject.localeCompare(right.subject);
    if (subjectCompare !== 0) return subjectCompare;
    const titleCompare = lessonTitle(left).localeCompare(lessonTitle(right));
    if (titleCompare !== 0) return titleCompare;
    return left.contentId.localeCompare(right.contentId);
  });
}

export function calculateReadiness(input: {
  grade: number;
  subject: string;
  lessons: LessonForYearMapping[];
  mappedContentIds: Set<string>;
  mappedWeeks: Set<number>;
  unitCount: number;
}): YearReadinessRow {
  const missingWeeks = Array.from({ length: CURRICULUM_YEAR_TARGETS.weeksPerGradeSubject }, (_, index) => index + 1)
    .filter((week) => !input.mappedWeeks.has(week));
  const mappedLessons = input.lessons.filter((lesson) => input.mappedContentIds.has(lesson.contentId)).length;
  const missingAssessments = Math.max(0, input.mappedWeeks.size - input.lessons.filter((lesson) => inferLessonPlanType(lesson) === "ASSESSMENT").length);
  const missingTeacherGuides = input.lessons.filter((lesson) => !JSON.stringify(lesson.payload).toLowerCase().includes("teacher")).length;
  const missingWorksheets = input.lessons.filter((lesson) => !JSON.stringify(lesson.payload).toLowerCase().includes("worksheet")).length;
  const missingAudio = input.lessons.filter((lesson) => !lesson.audioAssets?.length).length;
  const missingLabs = input.subject === "SCIENCE"
    ? input.lessons.filter((lesson) => inferLessonPlanType(lesson) !== "LAB").length
    : 0;

  return {
    grade: input.grade,
    subject: input.subject,
    totalLessons: input.lessons.length,
    mappedLessons,
    readinessPct: Math.min(100, Math.round((mappedLessons / CURRICULUM_YEAR_TARGETS.lessonsPerGradeSubject) * 100)),
    weeksCovered: input.mappedWeeks.size,
    unitsCovered: input.unitCount,
    missingWeeks,
    missingAssessments,
    missingTeacherGuides,
    missingWorksheets,
    missingAudio,
    missingLabs,
    classification: classifyCoverage(input.lessons.length),
  };
}

export async function getYearReadinessReport() {
  const [lessons, plans, units] = await Promise.all([
    prisma.curriculumContent.findMany({
      where: { status: { in: ["APPROVED", "approved", "published", "accepted"] } },
      select: {
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        contentType: true,
        lessonType: true,
        payload: true,
        moeAlignments: true,
        audioAssets: { select: { id: true }, take: 1 },
      },
    }),
    prisma.curriculumLessonPlan.findMany({
      select: {
        curriculumContentId: true,
        week: { select: { weekNumber: true, unit: { select: { gradeLevel: true, grade: true, subject: true } } } },
      },
    }),
    prisma.curriculumUnit.findMany({
      select: { id: true, gradeLevel: true, grade: true, subject: true },
    }),
  ]);

  const lessonGroups = new Map<string, LessonForYearMapping[]>();
  for (const lesson of lessons) {
    const key = `${lesson.grade}:${lesson.subject}`;
    lessonGroups.set(key, [...(lessonGroups.get(key) ?? []), lesson]);
  }

  const mappedByGroup = new Map<string, Set<string>>();
  const weeksByGroup = new Map<string, Set<number>>();
  for (const plan of plans) {
    const grade = plan.week.unit.gradeLevel ?? plan.week.unit.grade;
    const key = `${grade}:${plan.week.unit.subject}`;
    if (!mappedByGroup.has(key)) mappedByGroup.set(key, new Set());
    if (!weeksByGroup.has(key)) weeksByGroup.set(key, new Set());
    mappedByGroup.get(key)!.add(plan.curriculumContentId);
    weeksByGroup.get(key)!.add(plan.week.weekNumber);
  }

  const unitCountByGroup = new Map<string, number>();
  for (const unit of units) {
    const grade = unit.gradeLevel ?? unit.grade;
    const key = `${grade}:${unit.subject}`;
    unitCountByGroup.set(key, (unitCountByGroup.get(key) ?? 0) + 1);
  }

  return [...lessonGroups.entries()]
    .map(([key, groupLessons]) => {
      const [grade, subject] = key.split(":");
      return calculateReadiness({
        grade: Number(grade),
        subject,
        lessons: groupLessons,
        mappedContentIds: mappedByGroup.get(key) ?? new Set(),
        mappedWeeks: weeksByGroup.get(key) ?? new Set(),
        unitCount: unitCountByGroup.get(key) ?? 0,
      });
    })
    .sort((left, right) => left.grade - right.grade || left.subject.localeCompare(right.subject));
}

export async function mapExistingCurriculumToYearPlan() {
  const lessons = await prisma.curriculumContent.findMany({
    where: { status: { in: ["APPROVED", "approved", "published", "accepted"] } },
    select: {
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      contentType: true,
      lessonType: true,
      payload: true,
    },
  });

  const existingPlans = await prisma.curriculumLessonPlan.findMany({
    select: { curriculumContentId: true },
  });
  const alreadyMapped = new Set(existingPlans.map((plan) => plan.curriculumContentId));

  const groups = new Map<string, LessonForYearMapping[]>();
  for (const lesson of buildDeterministicLessonOrder(lessons)) {
    const key = `${lesson.grade}:${lesson.subject}`;
    groups.set(key, [...(groups.get(key) ?? []), lesson]);
  }

  const decisions: Array<{ contentId: string; unit: string; week: number; day: number; lessonType: string }> = [];
  const unitRows: Array<{
    unitId: string;
    name: string;
    title: string;
    description: string;
    subject: string;
    grade: number;
    gradeLevel: number;
    targetStandardCodes: string[];
    weekStart: number;
    weekEnd: number;
    orderIndex: number;
  }> = [];
  const weekBlueprints: Array<{ unitId: string; weekNumber: number; theme: string; orderIndex: number }> = [];
  const lessonBlueprints: Array<{
    unitId: string;
    weekNumber: number;
    lesson: LessonForYearMapping;
    dayNumber: number;
    orderIndex: number;
  }> = [];
  const pendingPlans: Array<{
    weekId: string;
    curriculumContentId: string;
    dayNumber: number;
    lessonType: ReturnType<typeof inferLessonPlanType>;
    mappedSource: "EXISTING";
    orderIndex: number;
  }> = [];

  for (const [key, groupLessons] of [...groups.entries()].sort()) {
    const [gradeRaw, subject] = key.split(":");
    const grade = Number(gradeRaw);
    const totalWeeks = Math.min(CURRICULUM_YEAR_TARGETS.weeksPerGradeSubject, Math.ceil(groupLessons.length / CURRICULUM_YEAR_TARGETS.lessonsPerWeek));
    const unitCount = Math.max(1, Math.ceil(totalWeeks / 4));

    for (let unitIndex = 1; unitIndex <= unitCount; unitIndex += 1) {
      const weekStart = (unitIndex - 1) * 4 + 1;
      const weekEnd = Math.min(totalWeeks, weekStart + 3);
      const unitLessons = groupLessons.slice((weekStart - 1) * 5, weekEnd * 5);
      const theme = deriveUnitTheme(unitLessons, unitIndex);
      const unitId = `yearmap-g${grade}-${subject.toLowerCase()}-u${String(unitIndex).padStart(2, "0")}`;
      unitRows.push({
        unitId,
        name: theme,
        title: theme,
        description: `Mapped existing Grade ${grade} ${subject.replace(/_/g, " ")} lessons for weeks ${weekStart}-${weekEnd}.`,
        subject,
        grade,
        gradeLevel: grade,
        targetStandardCodes: [],
        weekStart,
        weekEnd,
        orderIndex: unitIndex,
      });

      for (let weekNumber = weekStart; weekNumber <= weekEnd; weekNumber += 1) {
        const weekLessons = groupLessons.slice((weekNumber - 1) * 5, weekNumber * 5);
        const weekTheme = deriveUnitTheme(weekLessons, weekNumber);
        weekBlueprints.push({
          unitId,
          weekNumber,
          theme: weekTheme,
          orderIndex: weekNumber,
        });

        for (let index = 0; index < weekLessons.length; index += 1) {
          const lesson = weekLessons[index];
          if (alreadyMapped.has(lesson.contentId)) continue;
          const dayNumber = (index % CURRICULUM_YEAR_TARGETS.lessonsPerWeek) + 1;
          lessonBlueprints.push({
            unitId,
            weekNumber,
            lesson,
            dayNumber,
            orderIndex: index + 1,
          });
          alreadyMapped.add(lesson.contentId);
        }
      }
    }
  }

  for (let index = 0; index < unitRows.length; index += 500) {
    await prisma.curriculumUnit.createMany({
      data: unitRows.slice(index, index + 500),
      skipDuplicates: true,
    });
  }

  const unitIdMap = new Map(
    (await prisma.curriculumUnit.findMany({
      where: { unitId: { in: unitRows.map((unit) => unit.unitId) } },
      select: { id: true, unitId: true },
    })).map((unit) => [unit.unitId, unit.id])
  );

  const weekRows = weekBlueprints
    .map((week) => {
      const dbUnitId = unitIdMap.get(week.unitId);
      return dbUnitId
        ? { unitId: dbUnitId, weekNumber: week.weekNumber, theme: week.theme, orderIndex: week.orderIndex }
        : null;
    })
    .filter((week): week is NonNullable<typeof week> => Boolean(week));

  for (let index = 0; index < weekRows.length; index += 500) {
    await prisma.curriculumWeek.createMany({
      data: weekRows.slice(index, index + 500),
      skipDuplicates: true,
    });
  }

  const weeks = await prisma.curriculumWeek.findMany({
    where: { unitId: { in: [...unitIdMap.values()] } },
    select: { id: true, weekNumber: true, unit: { select: { unitId: true } } },
  });
  const weekMap = new Map(weeks.map((week) => [`${week.unit.unitId}:${week.weekNumber}`, week.id]));

  for (const blueprint of lessonBlueprints) {
    const weekId = weekMap.get(`${blueprint.unitId}:${blueprint.weekNumber}`);
    if (!weekId) continue;
    const lessonType = inferLessonPlanType(blueprint.lesson);
    pendingPlans.push({
      weekId,
      curriculumContentId: blueprint.lesson.contentId,
      dayNumber: blueprint.dayNumber,
      lessonType,
      mappedSource: "EXISTING",
      orderIndex: blueprint.orderIndex,
    });
    decisions.push({
      contentId: blueprint.lesson.contentId,
      unit: blueprint.unitId,
      week: blueprint.weekNumber,
      day: blueprint.dayNumber,
      lessonType,
    });
  }

  for (let index = 0; index < pendingPlans.length; index += 500) {
    await prisma.curriculumLessonPlan.createMany({
      data: pendingPlans.slice(index, index + 500),
      skipDuplicates: true,
    });
  }

  return { mappedLessons: pendingPlans.length, decisions };
}
