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
  estimatedPages?: number;
  estimatedPdfSizeBytes?: number;
  actualPages?: number;
  actualWords?: number;
  compileTimeMs?: number;
  generatedAt: Date;
};

export type TextbookFormat = "student" | "teacher" | "workbook" | "assessment";

export type TextbookSizeEstimate = {
  lessonCount: number;
  estimatedPages: number;
  estimatedPdfSizeBytes: number;
};

export type TextbookSection = {
  type: "cover" | "unit" | "lesson" | "summary";
  content: string;
  unitId?: string;
  lessonId?: string;
};

type CurriculumLessonRow = {
  id: string;
  contentId: string;
  unitId: string | null;
  orderInUnit: number | null;
  lessonType: string | null;
  payload: unknown;
};

const DEFAULT_MAX_LESSONS_PER_COMPILE = 500;
const ESTIMATED_WORDS_PER_PAGE = 400;
const ESTIMATED_PDF_BYTES_PER_PAGE = 50_000;

function estimatePagesFromWords(totalWords: number) {
  return Math.max(1, Math.ceil(totalWords / ESTIMATED_WORDS_PER_PAGE));
}

function estimatePdfSizeBytes(pages: number) {
  return pages * ESTIMATED_PDF_BYTES_PER_PAGE;
}

function countWords(value: string) {
  const matches = value.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

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

function renderLessonSection(lesson: CompiledLesson): string {
  const questions =
    lesson.assessmentQuestions.length > 0
      ? `\n\nQuestions\n${lesson.assessmentQuestions
          .map((question, index) => `${index + 1}. ${question}`)
          .join("\n")}`
      : "";
  const answerKey =
    lesson.answerKey.length > 0
      ? `\n\nAnswer Key\n${lesson.answerKey
          .map((answer, index) => `${index + 1}. ${answer}`)
          .join("\n")}`
      : "";

  return `# ${lesson.title}\n\n${lesson.content}${questions}${answerKey}`;
}

async function getSchoolName(schoolId?: string) {
  return schoolId
    ? (
        await prisma.school.findUnique({
          where: { id: schoolId },
          select: { name: true },
        })
      )?.name ?? "Ministry of Education, Liberia"
    : "Ministry of Education, Liberia";
}

async function getOrderedUnits(params: { subject: string; gradeLevel: number; schoolId?: string }) {
  return prisma.curriculumUnit.findMany({
    where: {
      subject: params.subject,
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
}

async function countApprovedLessons(params: {
  subject: string;
  gradeLevel: number;
  unitIds: string[];
}) {
  const directCount =
    params.unitIds.length > 0
      ? await prisma.curriculumContent.count({
          where: {
            unitId: { in: params.unitIds },
            contentType: "lesson",
            status: "APPROVED",
          },
        })
      : 0;

  if (directCount > 0) return directCount;

  return prisma.curriculumContent.count({
    where: {
      grade: params.gradeLevel,
      subject: params.subject,
      contentType: "lesson",
      status: "APPROVED",
    },
  });
}

async function countDirectUnitLessons(unitIds: string[]) {
  return unitIds.length > 0
    ? prisma.curriculumContent.count({
        where: {
          unitId: { in: unitIds },
          contentType: "lesson",
          status: "APPROVED",
        },
      })
    : 0;
}

async function estimateWordsForRows(where: any) {
  let totalWords = 0;
  const pageSize = 100;

  for (let skip = 0; ; skip += pageSize) {
    const rows = await prisma.curriculumContent.findMany({
      where,
      orderBy: [{ orderInUnit: "asc" }, { createdAt: "asc" }],
      skip,
      take: pageSize,
      select: { payload: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const payload = (row.payload as any) ?? {};
      const body =
        typeof payload.body === "string" && payload.body.trim().length > 0
          ? payload.body
          : typeof payload.body_standard === "string"
            ? payload.body_standard
            : "";
      totalWords += countWords(body);
    }

    if (rows.length < pageSize) break;
  }

  return totalWords;
}

async function getFallbackLessonsForUnit(params: {
  subject: string;
  gradeLevel: number;
  weekStart: number;
  weekEnd: number;
}) {
  const pageSize = 100;
  const unitLessons: CurriculumLessonRow[] = [];

  for (let skip = 0; ; skip += pageSize) {
    const rows = await prisma.curriculumContent.findMany({
      where: {
        grade: params.gradeLevel,
        subject: params.subject,
        contentType: "lesson",
        status: "APPROVED",
      },
      orderBy: [{ orderInUnit: "asc" }, { createdAt: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        contentId: true,
        unitId: true,
        orderInUnit: true,
        lessonType: true,
        payload: true,
      },
    });
    if (rows.length === 0) break;

    for (const lesson of rows) {
      const week = getLessonWeek(lesson.contentId, lesson.payload);
      if (week != null && week >= params.weekStart && week <= params.weekEnd) {
        unitLessons.push(lesson);
      }
    }

    if (rows.length < pageSize) break;
  }

  return unitLessons;
}

export async function estimateTextbookSize(params: {
  subject: string;
  grade?: number;
  gradeLevel?: number;
  schoolId?: string;
}): Promise<TextbookSizeEstimate> {
  const subject = params.subject.trim().toUpperCase();
  const gradeLevel = Number(params.gradeLevel ?? params.grade);
  const units = await getOrderedUnits({ subject, gradeLevel, schoolId: params.schoolId });
  const unitIds = units.map((unit) => unit.unitId);
  const lessonCount = await countApprovedLessons({ subject, gradeLevel, unitIds });
  const directLessonCount = await countDirectUnitLessons(unitIds);

  const directWhere = {
    unitId: { in: unitIds },
    contentType: "lesson",
    status: "APPROVED",
  };
  const fallbackWhere = {
    grade: gradeLevel,
    subject,
    contentType: "lesson",
    status: "APPROVED",
  };
  const totalWords = await estimateWordsForRows(directLessonCount > 0 ? directWhere : fallbackWhere);
  const estimatedPages = estimatePagesFromWords(totalWords || lessonCount * 400);

  return {
    lessonCount,
    estimatedPages,
    estimatedPdfSizeBytes: estimatePdfSizeBytes(estimatedPages),
  };
}

export async function compileTextbook(params: {
  subject: string;
  gradeLevel: number;
  schoolId?: string;
  title?: string;
  format?: TextbookFormat;
  maxLessonsPerCompile?: number;
  onSection?: (section: TextbookSection) => void | Promise<void>;
}): Promise<TextbookResult> {
  const startedAt = Date.now();
  const subject = params.subject.trim().toUpperCase();
  const format = params.format ?? "student";
  const maxLessonsPerCompile =
    params.maxLessonsPerCompile ?? DEFAULT_MAX_LESSONS_PER_COMPILE;
  const schoolName = await getSchoolName(params.schoolId);
  const title =
    params.title?.trim() ||
    `${subject.replace(/_/g, " ")} Grade ${params.gradeLevel}${
      format === "student" ? "" : ` ${format}`
    } Textbook`;

  if (format !== "student") {
    return {
      title,
      subject,
      gradeLevel: params.gradeLevel,
      schoolName,
      units: [],
      totalLessons: 0,
      generatedAt: new Date(),
    };
  }
  const units = await getOrderedUnits({ subject, gradeLevel: params.gradeLevel, schoolId: params.schoolId });

  if (units.length === 0) {
    return {
      title,
      subject,
      gradeLevel: params.gradeLevel,
      schoolName,
      units: [],
      totalLessons: 0,
      generatedAt: new Date(),
    };
  }

  const estimate = await estimateTextbookSize({
    subject,
    gradeLevel: params.gradeLevel,
    schoolId: params.schoolId,
  });
  if (estimate.lessonCount > maxLessonsPerCompile) {
    throw new Error("Textbook exceeds safe compile size");
  }

  await params.onSection?.({ type: "cover", content: title });

  const compiledUnits: CompiledUnit[] = [];
  let totalLessons = 0;
  let totalWords = 0;
  const directLessonCount = await countDirectUnitLessons(units.map((unit) => unit.unitId));

  for (const [index, unit] of units.entries()) {
    const unitLessons =
      directLessonCount > 0
        ? await prisma.curriculumContent.findMany({
            where: {
              unitId: unit.unitId,
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
          })
        : (
            await getFallbackLessonsForUnit({
              subject,
              gradeLevel: params.gradeLevel,
              weekStart: unit.weekStart,
              weekEnd: unit.weekEnd,
            })
          );
    const lessons = unitLessons.map(toCompiledLesson).sort(compareCompiledLessons);
    totalLessons += lessons.length;
    const compiledUnit: CompiledUnit = {
      id: unit.id,
      unitId: unit.unitId,
      title: unit.name,
      description: unit.description ?? null,
      subject: unit.subject,
      gradeLevel: unit.grade,
      orderIndex: index + 1,
      lessons,
    };

    await params.onSection?.({
      type: "unit",
      unitId: unit.unitId,
      content: `Unit ${index + 1}: ${unit.name}\n\n${unit.description ?? ""}`,
    });
    for (const lesson of lessons) {
      totalWords += countWords(lesson.content);
      await params.onSection?.({
        type: "lesson",
        unitId: unit.unitId,
        lessonId: lesson.id,
        content: renderLessonSection(lesson),
      });
    }
    compiledUnits.push(compiledUnit);

    console.info("textbook_compile_unit_processed", {
      subject,
      gradeLevel: params.gradeLevel,
      unitId: unit.unitId,
      lessonsProcessed: totalLessons,
      unitsProcessed: index + 1,
    });
  }

  const actualPages = estimatePagesFromWords(totalWords);
  const compileTimeMs = Date.now() - startedAt;
  await params.onSection?.({
    type: "summary",
    content: `Lessons: ${totalLessons}\nEstimated pages: ${estimate.estimatedPages}\nActual pages: ${actualPages}`,
  });
  console.info("textbook_compile_completed", {
    subject,
    gradeLevel: params.gradeLevel,
    lessonsProcessed: totalLessons,
    unitsProcessed: compiledUnits.length,
    estimatedPages: estimate.estimatedPages,
    actualPages,
    estimatedPdfSizeBytes: estimate.estimatedPdfSizeBytes,
    actualPdfSizeBytes: estimatePdfSizeBytes(actualPages),
    compileTimeMs,
  });

  return {
    title,
    subject,
    gradeLevel: params.gradeLevel,
    schoolName,
    units: compiledUnits,
    totalLessons,
    estimatedPages: estimate.estimatedPages,
    estimatedPdfSizeBytes: estimate.estimatedPdfSizeBytes,
    actualPages,
    actualWords: totalWords,
    compileTimeMs,
    generatedAt: new Date(),
  };
}
