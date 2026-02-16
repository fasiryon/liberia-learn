// app/api/attendance/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const CreateMeetingSchema = z.object({
  classId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json();
    const parsed = CreateMeetingSchema.parse(body);

    // Verify the class belongs to the user's school
    const cls = await prisma.class.findFirst({
      where: { id: parsed.classId, schoolId: user.schoolId },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // If teacher, verify they own the class
    if (user.role === "TEACHER" && cls.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { classId: parsed.classId },
      select: { studentId: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          classId: parsed.classId,
          startsAt: new Date(parsed.startsAt),
          endsAt: new Date(parsed.endsAt),
        },
      });

      if (enrollments.length > 0) {
        await tx.attendanceRecord.createMany({
          data: enrollments.map((e) => ({
            meetingId: meeting.id,
            studentId: e.studentId,
            status: "ABSENT" as const,
          })),
        });
      }

      return meeting;
    });

    return NextResponse.json({ ok: true, meeting: result }, { status: 201 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required" },
        { status: 400 }
      );
    }

    const meetings = await prisma.meeting.findMany({
      where: { classId },
      orderBy: { startsAt: "desc" },
      include: {
        attendance: {
          include: {
            Student: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Compute per-student stats
    const statsMap: Record<
      string,
      { studentId: string; name: string; present: number; absent: number; late: number }
    > = {};

    for (const meeting of meetings) {
      for (const record of meeting.attendance) {
        if (!statsMap[record.studentId]) {
          statsMap[record.studentId] = {
            studentId: record.studentId,
            name: record.Student?.user?.name ?? "Unknown",
            present: 0,
            absent: 0,
            late: 0,
          };
        }
        const s = statsMap[record.studentId];
        if (record.status === "PRESENT") s.present++;
        else if (record.status === "ABSENT") s.absent++;
        else if (record.status === "LATE") s.late++;
      }
    }

    return NextResponse.json({
      meetings,
      studentStats: Object.values(statsMap),
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
