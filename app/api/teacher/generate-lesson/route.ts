import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import {
  deriveAssessmentQuestions,
  deriveEstimatedMinutes,
  getTeacherClassOrThrow,
  inferClassGrade,
} from "@/lib/teacher/lessonAuthoring";
import { isTeacherGenerationEnabled } from "@/lib/serverFlags";

const SUBJECT_VALUES = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
] as const;

const QuerySchema = z.object({
  subject: z.enum(SUBJECT_VALUES).optional(),
  gradeLevel: z.coerce.number().int().min(1).max(12).optional(),
});

const GenerateSchema = z.object({
  classId: z.string().min(1),
  objective: z.string().trim().min(1).max(500),
  standardCode: z.string().trim().min(1).max(100).optional(),
  gradeLevel: z.number().int().min(1).max(12),
  subject: z.enum(SUBJECT_VALUES),
});

async function loadStandards(subject?: string, gradeLevel?: number) {
  if (!subject || !gradeLevel) {
    return [];
  }

  return prisma.standard.findMany({
    where: {
      subject: subject as any,
      band: gradeToBand(gradeLevel),
    },
    select: {
      code: true,
      description: true,
    },
    orderBy: { code: "asc" },
  });
}

function teacherGenerationDisabledResponse() {
  return NextResponse.json(
    { error: "teacher_generation_disabled" },
    { status: 503 }
  );
}

function isTeacherGenerationDisabled() {
  if (!isTeacherGenerationEnabled()) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (isTeacherGenerationDisabled()) {
      return teacherGenerationDisabledResponse();
    }
    const user = await requireRole("TEACHER");
    const parsed = QuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams.entries())
    );

    const classes = await prisma.class.findMany({
      where: { teacherId: user.id, schoolId: user.schoolId ?? undefined },
      select: {
        id: true,
        name: true,
        subject: true,
        enrollments: {
          select: {
            Student: {
              select: {
                currentGrade: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const standards = await loadStandards(parsed.subject, parsed.gradeLevel);

    await logAudit({
      userId: user.id,
      action: "teacher.lesson.form.read",
      resourceType: "teacher_lesson_generator",
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        subject: parsed.subject ?? null,
        gradeLevel: parsed.gradeLevel ?? null,
      },
    });

    return NextResponse.json({
      classes: classes.map((classRecord) => ({
        id: classRecord.id,
        name: classRecord.name,
        subject: classRecord.subject,
        gradeLevel: inferClassGrade(classRecord.enrollments),
      })),
      standards,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (isTeacherGenerationDisabled()) {
      return teacherGenerationDisabledResponse();
    }
    const user = await requireRole("TEACHER");
    const body = GenerateSchema.parse(await req.json());
    const classRecord = await getTeacherClassOrThrow(user.id, body.classId);

    if (classRecord.subject !== body.subject) {
      return NextResponse.json(
        { error: "Subject must match the selected class subject" },
        { status: 400 }
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const generationCount = await prisma.auditLog.count({
      where: {
        userId: user.id,
        action: "teacher.lesson.generated",
        createdAt: { gte: todayStart },
      },
    });

    if (generationCount >= 10) {
      return NextResponse.json(
        { error: "daily_generation_limit_reached", limit: 10 },
        { status: 429 }
      );
    }

    let standardDescription: string | undefined;
    if (body.standardCode) {
      const standard = await prisma.standard.findFirst({
        where: {
          code: body.standardCode,
          subject: body.subject,
          band: gradeToBand(body.gradeLevel),
        },
        select: { description: true },
      });

      if (!standard) {
        return NextResponse.json(
          { error: "Selected MOE standard is not valid for this subject and grade" },
          { status: 400 }
        );
      }
      standardDescription = standard.description;
    }

    const payload = await generateCurriculumPayload({
      grade: body.gradeLevel,
      subject: body.subject,
      topic: body.objective,
      contentType: "lesson",
      lessonFormat: "either",
      moeAlignmentCodes: body.standardCode ? [body.standardCode] : undefined,
      liberiaContext: true,
    });

    const assessmentQuestions = deriveAssessmentQuestions({
      objectives: payload.objectives,
      activities: payload.activities,
      deliveryProfile: (payload as any).deliveryProfile ?? null,
    });
    const estimatedMinutes = deriveEstimatedMinutes({
      body: payload.body,
      body_standard: payload.body_standard,
      body_block: payload.body_block,
      deliveryProfile: (payload as any).deliveryProfile ?? null,
    });

    await logAudit({
      userId: user.id,
      action: "teacher.lesson.generated",
      resourceType: "teacher_lesson_generator",
      resourceId: classRecord.id,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        classId: classRecord.id,
        gradeLevel: body.gradeLevel,
        subject: body.subject,
        hasStandardCode: Boolean(body.standardCode),
        standardDescription: standardDescription ?? null,
      },
    });

    return NextResponse.json({
      title: payload.title,
      content: payload.body_standard ?? payload.body,
      standardContent: payload.body_standard ?? payload.body,
      blockContent: payload.body_block ?? null,
      assessmentQuestions,
      estimatedMinutes,
      standardCode: body.standardCode ?? null,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
