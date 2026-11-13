// app/api/attendance/[meetingId]/route.ts
import { NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=teacher-or-school-admin; rationale=Attendance requires a school-bound staff caller, meeting authority and membership validation for every submitted learner.
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const Schema = z.object({
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE"]),
    })
  ),
});

export async function PATCH(
  req: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId?.trim()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { meetingId } = params;

    const body = await req.json();
    const validation = Schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid attendance records" }, { status: 400 });
    }
    const parsed = validation.data;
    const studentIds = parsed.records.map(record => record.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      return NextResponse.json({ error: "Duplicate student records" }, { status: 400 });
    }

    // Verify the meeting belongs to the user's school
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, Class: { schoolId: user.schoolId } },
      include: { Class: true },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (user.role === "TEACHER" && meeting.Class.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Authorize the complete batch before the first canonical write. A class
    // link alone must not admit a student whose current tenant has changed.
    const roster = await prisma.enrollment.findMany({
      where: {
        classId: meeting.classId, studentId: { in: studentIds },
        Class: { schoolId: user.schoolId },
        Student: { deletedAt: null, user: { schoolId: user.schoolId } },
      },
      select: { studentId: true },
    });
    const allowed = new Set(roster.map(record => record.studentId));
    if (studentIds.some(id => !allowed.has(id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = await Promise.all(
      parsed.records.map((r) =>
        prisma.attendanceRecord.upsert({
          where: {
            meetingId_studentId: {
              meetingId,
              studentId: r.studentId,
            },
          },
          update: { status: r.status, markedAt: new Date() },
          create: {
            meetingId,
            studentId: r.studentId,
            status: r.status,
          },
        })
      )
    );

    return NextResponse.json({ ok: true, updated: results.length });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
