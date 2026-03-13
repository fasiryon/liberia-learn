import { prisma } from "@/lib/db";

export type CompiledLesson = {
  id: string;
  contentId: string;
  title: string;
  content: string;
  lessonType: string | null;
  orderInUnit: number | null;
  assessmentQuestions: string[];
  answerKey: string[];
};

export type CompiledUnit = {
  id: string;
  unitId: string;
  title: string;
  description: string | null;
  subject: string;
  gradeLevel: number;
  orderIndex: number;
  lessons: CompiledLesson[];
};

export type TextbookResult = {
  title: string;
  subject: string;
  gradeLevel: number;
  units: CompiledUnit[];
  totalLessons: number;
  generatedAt: Date;
};

export async function compileTextbook(params: {
  subject: string;
  gradeLevel: number;
  schoolId?: string;
  title?: string;
}): Promise<TextbookResult> {
  const subject = params.subject.trim().toUpperCase();
  const units = await prisma.curriculumUnit.findMany({
    where: {
      subject,
      grade: params.gradeLevel,
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    },
    orderBy: [{ weekStart: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      unitId: true,
      name: true,
      description: true,
      subject: true,
      grade: true,
      weekStart: true,
    },
  });

  if (units.length === 0) {
    return {
      title:
        params.title?.trim() ||
        `${subject.replace(/_/g, " ")} Grade ${params.gradeLevel} Textbook`,
      subject,
      gradeLevel: params.gradeLevel,
      units: [],
      totalLessons: 0,
      generatedAt: new Date(),
    };
  }

  const lessons = await prisma.curriculumContent.findMany({
    where: {
      unitId: { in: units.map((unit) => unit.unitId) },
    },
    orderBy: [{ unitId: "asc" }, { orderInUnit: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      contentId: true,
      unitId: true,
      orderInUnit: true,
      lessonType: true,
      payload: true,
    },
  });

  const lessonMap = new Map<string, CompiledLesson[]>();
  for (const lesson of lessons) {
    const key = lesson.unitId ?? "";
    const current = lessonMap.get(key) ?? [];
    const payload = (lesson.payload as any) ?? {};
    current.push({
      id: lesson.id,
      contentId: lesson.contentId,
      title:
        typeof payload.title === "string" && payload.title.trim().length > 0
          ? payload.title.trim()
          : lesson.contentId,
      content:
        typeof payload.body === "string" && payload.body.trim().length > 0
          ? payload.body.trim()
          : "Lesson content unavailable.",
      lessonType: lesson.lessonType ?? null,
      orderInUnit: lesson.orderInUnit ?? null,
      assessmentQuestions: Array.isArray(payload.assessmentQuestions)
        ? payload.assessmentQuestions
            .filter((question: unknown): question is string => typeof question === "string")
            .map((question) => question.trim())
            .filter(Boolean)
        : [],
      answerKey: Array.isArray(payload.answerKey)
        ? payload.answerKey
            .filter((answer: unknown): answer is string => typeof answer === "string")
            .map((answer) => answer.trim())
            .filter(Boolean)
        : [],
    });
    lessonMap.set(key, current);
  }

  const compiledUnits: CompiledUnit[] = units.map((unit, index) => ({
    id: unit.id,
    unitId: unit.unitId,
    title: unit.name,
    description: unit.description ?? null,
    subject: unit.subject,
    gradeLevel: unit.grade,
    orderIndex: index + 1,
    lessons: (lessonMap.get(unit.unitId) ?? []).sort(
      (left, right) => (left.orderInUnit ?? 0) - (right.orderInUnit ?? 0)
    ),
  }));

  return {
    title:
      params.title?.trim() ||
      `${subject.replace(/_/g, " ")} Grade ${params.gradeLevel} Textbook`,
    subject,
    gradeLevel: params.gradeLevel,
    units: compiledUnits,
    totalLessons: compiledUnits.reduce((sum, unit) => sum + unit.lessons.length, 0),
    generatedAt: new Date(),
  };
}
