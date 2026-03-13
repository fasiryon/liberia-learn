import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isUnitAssemblyEnabled } from "@/lib/serverFlags";
import { assembleUnit } from "@/lib/ai/units/unitAssembler";

export const dynamic = "force-dynamic";

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

const CreateUnitSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  gradeLevel: z.number().int().min(1).max(12),
  unitTitle: z.string().trim().min(3).max(200),
  unitDescription: z.string().trim().max(1000).optional().default(""),
});

const ListUnitsSchema = z.object({
  subject: z.enum(SUBJECT_VALUES).optional(),
  gradeLevel: z.coerce.number().int().min(1).max(12).optional(),
  schoolId: z.string().min(1).optional(),
});

function unitAssemblyDisabledResponse() {
  return NextResponse.json({ error: "unit_assembly_disabled" }, { status: 503 });
}

async function requireAdminScope() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

function resolveSchoolScope(user: Awaited<ReturnType<typeof requireUser>>, requested?: string) {
  if (user.isPlatformAdmin) {
    const scopedSchoolId = requested ?? user.schoolId ?? null;
    if (!scopedSchoolId) {
      throw Object.assign(new Error("schoolId is required for platform-admin access"), {
        status: 400,
      });
    }
    return scopedSchoolId;
  }

  if (!user.schoolId) {
    throw Object.assign(new Error("No school context"), { status: 400 });
  }

  return user.schoolId;
}

export async function GET(req: NextRequest) {
  if (!isUnitAssemblyEnabled()) {
    return unitAssemblyDisabledResponse();
  }

  try {
    const traceId = randomUUID();
    const user = await requireAdminScope();
    const query = ListUnitsSchema.parse(
      Object.fromEntries(new URL(req.url).searchParams.entries())
    );
    const schoolId = resolveSchoolScope(user, query.schoolId);

    const units = await prisma.curriculumUnit.findMany({
      where: {
        schoolId,
        ...(query.subject ? { subject: query.subject } : {}),
        ...(query.gradeLevel != null ? { grade: query.gradeLevel } : {}),
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
        createdAt: true,
      },
    });

    const unitIds = units.map((unit) => unit.unitId);
    const lessons =
      unitIds.length === 0
        ? []
        : await prisma.curriculumContent.findMany({
            where: { unitId: { in: unitIds } },
            orderBy: [{ unitId: "asc" }, { orderInUnit: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              contentId: true,
              contentType: true,
              lessonType: true,
              orderInUnit: true,
              status: true,
              payload: true,
              unitId: true,
            },
          });

    const lessonMap = new Map<string, typeof lessons>();
    for (const lesson of lessons) {
      const key = lesson.unitId ?? "";
      const current = lessonMap.get(key) ?? [];
      current.push(lesson);
      lessonMap.set(key, current);
    }

    await logAudit({
      userId: user.id,
      action: "admin.unit.listed",
      resourceType: "curriculum_unit",
      schoolId,
      traceId,
      details: {
        subject: query.subject ?? null,
        gradeLevel: query.gradeLevel ?? null,
      },
    });

    return NextResponse.json({
      units: units.map((unit) => {
        const unitLessons = lessonMap.get(unit.unitId) ?? [];
        return {
          ...unit,
          lessonCount: unitLessons.length,
          lessons: unitLessons.map((lesson) => ({
            id: lesson.id,
            contentId: lesson.contentId,
            contentType: lesson.contentType,
            lessonType: lesson.lessonType,
            orderInUnit: lesson.orderInUnit,
            status: lesson.status,
            title:
              typeof (lesson.payload as any)?.title === "string"
                ? (lesson.payload as any).title
                : lesson.contentId,
          })),
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  if (!isUnitAssemblyEnabled()) {
    return unitAssemblyDisabledResponse();
  }

  try {
    const traceId = randomUUID();
    const user = await requireAdminScope();
    const schoolId = resolveSchoolScope(user);
    const body = CreateUnitSchema.parse(await req.json());

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAssemblies = await prisma.auditLog.count({
      where: {
        userId: user.id,
        action: "admin.unit.assembled",
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentAssemblies >= 1) {
      return NextResponse.json(
        { error: "unit_assembly_rate_limited", retryAfterSeconds: 3600 },
        { status: 429 }
      );
    }

    const assembled = await assembleUnit({
      subject: body.subject,
      gradeLevel: body.gradeLevel,
      unitTitle: body.unitTitle,
      unitDescription: body.unitDescription,
      schoolId,
      createdById: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "admin.unit.assembled",
      resourceType: "curriculum_unit",
      resourceId: assembled.unit.unitId,
      schoolId,
      traceId,
      details: {
        subject: body.subject,
        gradeLevel: body.gradeLevel,
        lessonCount: assembled.lessons.length,
      },
    });

    return NextResponse.json({
      unitId: assembled.unit.unitId,
      lessonCount: assembled.lessons.length,
      status: "assembled",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
