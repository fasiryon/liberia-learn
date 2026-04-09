import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  createTimetableForSchool,
  createTimetableSchema,
  deleteTimetableForSchool,
  deleteTimetableSchema,
  listOperationalReferencesForSchool,
  listTimetableForSchool,
  resolveAdminSchoolScope,
  updateTimetableForSchool,
  updateTimetableSchema,
} from "@/lib/records/schoolOperations";

export const dynamic = "force-dynamic";

function assertAdmin(user: { role: string; isPlatformAdmin?: boolean }) {
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const schoolId = resolveAdminSchoolScope(user, req.nextUrl.searchParams.get("schoolId"));
    const [timetable, references] = await Promise.all([
      listTimetableForSchool(schoolId),
      listOperationalReferencesForSchool(schoolId),
    ]);

    return NextResponse.json({
      timetable,
      teachers: references.teachers,
      classes: references.classes,
    });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/timetable", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const body = createTimetableSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const timetable = await createTimetableForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "admin.timetable.created",
      resourceType: "timetable",
      resourceId: timetable.id,
      traceId: requestId,
      details: {
        teacherId: timetable.teacherId,
        classId: timetable.classId,
        dayOfWeek: timetable.dayOfWeek,
        periodLabel: timetable.periodLabel,
      },
    });

    return NextResponse.json({ timetable }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/timetable", method: "POST" });
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const body = updateTimetableSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const timetable = await updateTimetableForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "admin.timetable.updated",
      resourceType: "timetable",
      resourceId: timetable.id,
      traceId: requestId,
      details: {
        teacherId: timetable.teacherId,
        classId: timetable.classId,
        dayOfWeek: timetable.dayOfWeek,
        periodLabel: timetable.periodLabel,
      },
    });

    return NextResponse.json({ timetable });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/timetable", method: "PATCH" });
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const body = deleteTimetableSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    await deleteTimetableForSchool(schoolId, body.timetableId);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "admin.timetable.deleted",
      resourceType: "timetable",
      resourceId: body.timetableId,
      traceId: requestId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/timetable", method: "DELETE" });
  }
}
