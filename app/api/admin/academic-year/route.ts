import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  activateAcademicYearForSchool,
  createAcademicYearForSchool,
  createAcademicYearSchema,
  listAcademicYearsForSchool,
  resolveAdminSchoolScope,
  updateAcademicYearSchema,
} from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, req.nextUrl.searchParams.get("schoolId"));
    const academicYears = await listAcademicYearsForSchool(schoolId);
    return NextResponse.json({ academicYears });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/academic-year", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = createAcademicYearSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const academicYear = await createAcademicYearForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      action: "admin.academic_year.created",
      resourceType: "academic_year",
      resourceId: academicYear.id,
      schoolId,
      traceId: requestId,
      details: {
        yearLabel: academicYear.yearLabel,
        isActive: academicYear.isActive,
        termCount: academicYear.terms.length,
      },
    });

    return NextResponse.json({ academicYear }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/academic-year", method: "POST" });
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = updateAcademicYearSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);

    if (body.isActive !== true) {
      throw Object.assign(new Error("Only activation is supported"), { status: 400 });
    }

    const academicYear = await activateAcademicYearForSchool(schoolId, body.academicYearId);
    await logAudit({
      userId: user.id,
      action: "admin.academic_year.activated",
      resourceType: "academic_year",
      resourceId: academicYear.id,
      schoolId,
      traceId: requestId,
      details: {
        yearLabel: academicYear.yearLabel,
      },
    });

    return NextResponse.json({ academicYear });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/academic-year", method: "PATCH" });
  }
}
