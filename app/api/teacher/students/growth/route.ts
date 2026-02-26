import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isLongitudinalTrackingEnabled } from "@/lib/serverFlags";
import {
  listStudentSnapshotsForPeriod,
  startOfMonthUtc,
} from "@/lib/metrics/longitudinal/growthRepo";
import { captureMonthlySnapshotsForStudents } from "@/lib/metrics/longitudinal/growthTracker";

export const dynamic = "force-dynamic";

function parsePeriodStart(value: string | null): Date {
  if (!value) return startOfMonthUtc(new Date());
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw Object.assign(new Error("periodStart must be YYYY-MM"), { status: 400 });
  }
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isLongitudinalTrackingEnabled()) {
      return NextResponse.json({ error: "longitudinal_tracking_disabled" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    const schoolId = user.schoolId ?? null;
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const periodStart = parsePeriodStart(searchParams.get("periodStart"));

    const teacherClasses = await prisma.class.findMany({
      where: {
        schoolId,
        teacherId: user.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const classIds = teacherClasses.map((c) => c.id);
    if (classIds.length === 0) {
      return NextResponse.json({
        periodStart: periodStart.toISOString(),
        students: [],
      });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classId: { in: classIds },
      },
      include: {
        Student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const classNameById = new Map(teacherClasses.map((c) => [c.id, c.name]));
    const studentInfoByStudentId = new Map<
      string,
      {
        studentId: string;
        userId: string;
        name: string;
        classId: string;
        className: string;
      }
    >();

    for (const row of enrollments) {
      const studentId = row.Student.id;
      if (!studentInfoByStudentId.has(studentId)) {
        studentInfoByStudentId.set(studentId, {
          studentId,
          userId: row.Student.user.id,
          name: row.Student.user.name ?? row.Student.user.email ?? "Unknown",
          classId: row.classId,
          className: classNameById.get(row.classId) ?? "Unknown",
        });
      }
    }

    const studentIds = Array.from(studentInfoByStudentId.keys());

    await captureMonthlySnapshotsForStudents({
      tenantId: schoolId,
      schoolId,
      studentIds,
      periodStart,
    });

    const snapshots = await listStudentSnapshotsForPeriod({
      tenantId: schoolId,
      schoolId,
      studentIds,
      periodStart,
    });

    const growthByStudent = new Map<
      string,
      Array<{
        subject: string;
        strandKey: string | null;
        score: number;
        growthRate: number;
        classification: "on_track" | "at_risk" | "accelerating";
      }>
    >();

    for (const snapshot of snapshots) {
      const arr = growthByStudent.get(snapshot.studentId) ?? [];
      arr.push({
        subject: snapshot.subject,
        strandKey: snapshot.strandKey,
        score: snapshot.score,
        growthRate: snapshot.growthRate,
        classification: snapshot.classification as "on_track" | "at_risk" | "accelerating",
      });
      growthByStudent.set(snapshot.studentId, arr);
    }

    const students = studentIds
      .map((studentId) => {
        const info = studentInfoByStudentId.get(studentId);
        if (!info) return null;
        return {
          studentId: info.studentId,
          userId: info.userId,
          name: info.name,
          classId: info.classId,
          className: info.className,
          growth: growthByStudent.get(studentId) ?? [],
        };
      })
      .filter(Boolean);

    await logAudit({
      userId: user.id,
      action: "growth.teacher.students.viewed",
      resourceType: "longitudinal_growth",
      schoolId,
      traceId,
      details: {
        periodStart: periodStart.toISOString(),
        studentCount: students.length,
      },
    });

    return NextResponse.json({
      periodStart: periodStart.toISOString(),
      students,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
