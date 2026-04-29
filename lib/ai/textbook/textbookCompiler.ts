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
  schoolName?: string;
  units: CompiledUnit[];
  totalLessons: number;
  generatedAt: Date;
};

export type TextbookFormat = "student" | "teacher" | "workbook" | "assessment";

type CurriculumLessonRow = {
  id: string;
  contentId: string;
  unitId: string | null;
  orderInUnit: number | null;
  lessonType: string | null;
  payload: unknown;
};

function getLessonWeek(contentId: string, payload: unknown): number | null {
  const payloadWeek = (payload as any)?.week;
  if (Number.isFinite(Number(payloadWeek))) return Number(payloadWeek);
  const match = contentId.match(/(?:^|-)w(\d{1,2})(?:-|$)/i);
  return match ? Number(match[1]) : null;
}

function toCompiledLesson(lesson: CurriculumLessonRow): CompiledLesson {
  const payload = (lesson.payload as any) ?? {};
  return {
    id: lesson.id,
    contentId: lesson.contentId,
    title:
      typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : lesson.contentId,
    content:
      typeof payload.body === "string" && payload.body.trim().length > 0
        ? payload.body.trim()
        : typeof payload.body_standard === "string" && payload.body_standard.trim().length > 0
          ? payload.body_standard.trim()
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
  };
}

function compareCompiledLessons(left: CompiledLesson, right: CompiledLesson) {
  const leftWeek = getLessonWeek(left.contentId, null) ?? Number.MAX_SAFE_INTEGER;
  const rightWeek = getLessonWeek(right.contentId, null) ?? Number.MAX_SAFE_INTEGER;
  if (leftWeek !== rightWeek) return leftWeek - rightWeek;
  const leftOrder = left.orderInUnit ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderInUnit ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.contentId.localeCompare(right.contentId);
}

export async function compileTextbook(params: {
  subject: string;
  gradeLevel: number;
  schoolId?: string;
  title?: string;
  format?: TextbookFormat;
}): Promise<TextbookResult> {
  const subject = params.subject.trim().toUpperCase();
  const format = params.format ?? "student";
  const schoolName = params.schoolId
    ? (
        await prisma.school.findUnique({
          where: { id: params.schoolId },
          select: { name: true },
        })
      )?.name ?? "Ministry of Education, Liberia"
    : "Ministry of Education, Liberia";

  if (format !== "student") {
    return {
      title:
        params.title?.trim() ||
        `${subject.replace(/_/g, " ")} Grade ${params.gradeLevel} ${format} Textbook`,
      subject,
      gradeLevel: params.gradeLevel,
      schoolName,
      units: [],
      totalLessons: 0,
      generatedAt: new Date(),
    };
  }
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
      weekEnd: true,
    },
  });

  if (units.length === 0) {
    return {
      title:
        params.title?.trim() ||
        `${subject.replace(/_/g, " ")} Grade ${params.gradeLevel} Textbook`,
      subject,
      gradeLevel: params.gradeLevel,
      schoolName,
      units: [],
      totalLessons: 0,
      generatedAt: new Date(),
    };
  }

  let lessons = await prisma.curriculumContent.findMany({
    where: {
      unitId: { in: units.map((unit) => unit.unitId) },
      contentType: "lesson",
      status: "APPROVED",
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

  if (lessons.length === 0) {
    lessons = await prisma.curriculumContent.findMany({
      where: {
        grade: params.gradeLevel,
        subject,
        contentType: "lesson",
        status: "APPROVED",
      },
      orderBy: [{ orderInUnit: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        contentId: true,
        unitId: true,
        orderInUnit: true,
        lessonType: true,
        payload: true,
      },
    });
  }

  const lessonMap = new Map<string, CompiledLesson[]>();
  for (const lesson of lessons) {
    const directKey = units.some((unit) => unit.unitId === lesson.unitId) ? lesson.unitId : null;
    const week = directKey ? null : getLessonWeek(lesson.contentId, lesson.payload);
    const weekUnit =
      week == null
        ? null
        : units.find((unit) => week >= unit.weekStart && week <= unit.weekEnd);
    const key = directKey ?? weekUnit?.unitId ?? lesson.unitId ?? "";
    const current = lessonMap.get(key) ?? [];
    current.push(toCompiledLesson(lesson));
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
      compareCompiledLessons
    ),
  }));

  return {
    title:
      params.title?.trim() ||
      `${subject.replace(/_/g, " ")} Grade ${params.gradeLevel} Textbook`,
    subject,
    gradeLevel: params.gradeLevel,
    schoolName,
    units: compiledUnits,
    totalLessons: compiledUnits.reduce((sum, unit) => sum + unit.lessons.length, 0),
    generatedAt: new Date(),
  };
}
