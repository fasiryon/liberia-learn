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
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";
import { sendPushToUser } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";
const SCHOOL_LOOKUP_TIMEOUT_MS = 250;

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
        school = await Promise.race([
          schoolModel.findUnique({
            where: { id: user.schoolId },
            select: { districtId: true },
          }),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), SCHOOL_LOOKUP_TIMEOUT_MS);
          }),
        ]);
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

    // Push to guardians of absent students (fire-and-forget)
    const absentRecords = attendance.filter((a: any) => a.status === "ABSENT");
    if (absentRecords.length > 0) {
      const absentStudentIds = absentRecords.map((a: any) => a.studentId);
      const guardianLinks = await prisma.studentGuardian.findMany({
        where: { studentId: { in: absentStudentIds } },
        select: {
          guardianId: true,
          student: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      });

      for (const link of guardianLinks) {
        const childName = link.student.user.name ?? "Your child";
        sendPushToUser(link.guardianId, {
          title: "Attendance Alert",
          body: `${childName} was marked absent today`,
          url: "/guardian/attendance",
        }).catch(() => null);
      }
    }

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

    const statusCounts = attendance.reduce<Record<string, number>>((acc, row: any) => {
      const status = String(row.status ?? "UNKNOWN");
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    await logProductSignal({
      schoolId: user.schoolId ?? null,
      districtId: school?.districtId ?? null,
      classId: body.classId,
      userId: user.id,
      actor: { type: "user", id: user.id, role: user.role },
      target: { type: "attendance", id: body.classId },
      eventType: "attendance.updated",
      source: "/api/teacher/attendance",
      occurredAt: body.date,
      dedupeKey: `attendance.updated:${user.schoolId ?? "unknown"}:${body.classId}:${body.date.toISOString().slice(0, 10)}`,
      metadata: {
        recordCount: attendance.length,
        statusCounts,
      },
    });

    return NextResponse.json({ attendance });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/teacher/attendance", method: "POST" });
  }
}
