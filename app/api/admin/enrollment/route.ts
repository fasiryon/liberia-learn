import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  createAcademicEnrollmentForSchool,
  createAcademicEnrollmentSchema,
  listAcademicEnrollmentsForSchool,
  resolveAdminSchoolScope,
  updateAcademicEnrollmentSchema,
  updateAcademicEnrollmentStatusForSchool,
} from "@/lib/records/systemOfRecord";
import { prisma } from "@/lib/db";
import { generateEnrollmentLetter } from "@/lib/canva/templates/enrollmentLetter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, req.nextUrl.searchParams.get("schoolId"));
    const enrollments = await listAcademicEnrollmentsForSchool(schoolId);
    return NextResponse.json({ enrollments });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/enrollment", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = createAcademicEnrollmentSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const enrollment = await createAcademicEnrollmentForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      action: "admin.academic_enrollment.created",
      resourceType: "academic_enrollment",
      resourceId: enrollment.id,
      schoolId,
      traceId: requestId,
      details: {
        studentId: enrollment.studentId,
        academicYearId: enrollment.academicYearId,
        grade: enrollment.grade,
        status: enrollment.status,
      },
    });

    // Auto-trigger enrollment letter generation (fire-and-forget)
    void prisma.student
      .findFirst({
        where: { id: enrollment.studentId },
        include: {
          user: { select: { id: true, name: true } },
          guardians: {
            include: { guardian: { select: { name: true } } },
            take: 1,
          },
        },
      })
      .then(async (student) => {
        if (!student) return;
        const guardianName =
          student.guardians?.[0]?.guardian?.name ?? "Parent/Guardian";
        await generateEnrollmentLetter(
          {
            studentName: student.user.name ?? "Student",
            guardianName,
            grade: enrollment.grade ? `Grade ${enrollment.grade}` : "Not specified",
            schoolName: schoolId,
            enrollmentDate: new Date().toLocaleDateString("en-LR"),
            academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          },
          schoolId,
          student.user.id,
          user.id
        );
      })
      .catch(() => null);

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/enrollment", method: "POST" });
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = updateAcademicEnrollmentSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const enrollment = await updateAcademicEnrollmentStatusForSchool(schoolId, body.enrollmentId, body.status);

    await logAudit({
      userId: user.id,
      action: "admin.academic_enrollment.updated",
      resourceType: "academic_enrollment",
      resourceId: enrollment.id,
      schoolId,
      traceId: requestId,
      details: {
        studentId: enrollment.studentId,
        academicYearId: enrollment.academicYearId,
        status: enrollment.status,
      },
    });

    return NextResponse.json({ enrollment });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/enrollment", method: "PATCH" });
  }
}
