import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  createTeacherAssignmentForSchool,
  createTeacherAssignmentSchema,
  deleteTeacherAssignmentForSchool,
  deleteTeacherAssignmentSchema,
  listOperationalReferencesForSchool,
  listTeacherAssignmentsForSchool,
  resolveAdminSchoolScope,
  updateTeacherAssignmentForSchool,
  updateTeacherAssignmentSchema,
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
    const [assignments, references] = await Promise.all([
      listTeacherAssignmentsForSchool(schoolId),
      listOperationalReferencesForSchool(schoolId),
    ]);

    return NextResponse.json({
      assignments,
      teachers: references.teachers,
      classes: references.classes,
    });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/assignments", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const body = createTeacherAssignmentSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const assignment = await createTeacherAssignmentForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "admin.teacher_assignment.created",
      resourceType: "teacher_assignment",
      resourceId: assignment.id,
      traceId: requestId,
      details: {
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subject: assignment.subject,
        isPrimary: assignment.isPrimary,
      },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/assignments", method: "POST" });
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const body = updateTeacherAssignmentSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const assignment = await updateTeacherAssignmentForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "admin.teacher_assignment.updated",
      resourceType: "teacher_assignment",
      resourceId: assignment.id,
      traceId: requestId,
      details: {
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subject: assignment.subject,
        isPrimary: assignment.isPrimary,
      },
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/assignments", method: "PATCH" });
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertAdmin(user);
    const body = deleteTeacherAssignmentSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    await deleteTeacherAssignmentForSchool(schoolId, body.assignmentId);

    await logAudit({
      userId: user.id,
      schoolId,
      action: "admin.teacher_assignment.deleted",
      resourceType: "teacher_assignment",
      resourceId: body.assignmentId,
      traceId: requestId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/assignments", method: "DELETE" });
  }
}
