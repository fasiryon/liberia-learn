import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  listTeacherAttendanceContext,
  upsertAttendanceForTeacher,
  upsertAttendanceSchema,
} from "@/lib/records/schoolOperations";
import { validateAttendanceCompliance } from "@/lib/policy/policyEngine";

export const dynamic = "force-dynamic";

function assertTeacherAccess(user: { role: string }) {
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertTeacherAccess(user);
    const classId = req.nextUrl.searchParams.get("classId");
    const date = req.nextUrl.searchParams.get("date");
    const context = await listTeacherAttendanceContext(user, classId, date ? new Date(date) : undefined);

    return NextResponse.json({
      classes: context.classes,
      roster: context.roster,
      attendance: context.attendance,
      selectedDate: context.selectedDate,
    });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/teacher/attendance", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    assertTeacherAccess(user);
    const body = upsertAttendanceSchema.parse(await req.json());
    const schoolModel = (prisma as typeof prisma & {
      school?: { findUnique?: (args: unknown) => Promise<{ districtId?: string | null } | null> };
    }).school;
    let school: { districtId?: string | null } | null = null;
    if (user.schoolId && schoolModel?.findUnique) {
      try {
        school = await schoolModel.findUnique({
          where: { id: user.schoolId },
          select: { districtId: true },
        });
      } catch {
        school = null;
      }
    }
    await validateAttendanceCompliance({
      schoolId: user.schoolId ?? null,
      districtId: school?.districtId ?? null,
      attendanceDate: body.date,
    });
    const attendance = await upsertAttendanceForTeacher(user, body);

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? undefined,
      action: "teacher.attendance.upserted",
      resourceType: "attendance",
      resourceId: body.classId,
      traceId: requestId,
      details: {
        classId: body.classId,
        date: body.date.toISOString(),
        recordCount: attendance.length,
      },
    });

    return NextResponse.json({ attendance });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/teacher/attendance", method: "POST" });
  }
}
