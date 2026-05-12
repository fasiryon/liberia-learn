import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { meetingId } = params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        Class: { select: { teacherId: true } },
        attendees: { select: { userId: true } },
      },
    });
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.Class.teacherId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (meeting.liveStatus !== "LIVE") {
      return NextResponse.json({ error: "Session is not live" }, { status: 400 });
    }

    const endedAt = new Date();
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { liveStatus: "ENDED", endedAt },
    });

    const attendeeUserIds = meeting.attendees.map((a) => a.userId);
    const attendeeCount = attendeeUserIds.length;

    if (attendeeUserIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { userId: { in: attendeeUserIds } },
        select: { id: true },
      });
      const studentIds = students.map((s) => s.id);

      await Promise.all(
        studentIds.map((studentId) =>
          prisma.attendanceRecord.upsert({
            where: { meetingId_studentId: { meetingId, studentId } },
            update: {},
            create: { meetingId, studentId, status: "PRESENT" },
          })
        )
      );
    }

    const duration =
      meeting.startedAt
        ? Math.round((endedAt.getTime() - meeting.startedAt.getTime()) / 60000)
        : 0;

    void logAudit({
      userId: user.id,
      action: "meeting.ended",
      resourceType: "Meeting",
      resourceId: meetingId,
      details: { duration, attendeeCount },
      schoolId: user.schoolId,
    });

    return NextResponse.json({ duration, attendeeCount });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
