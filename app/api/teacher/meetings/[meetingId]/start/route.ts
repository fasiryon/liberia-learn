import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateJitsiRoomId, buildJoinUrl } from "@/lib/meetings/jitsiService";
import { sendPushToClass, sendPushToMany } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { meetingId } = params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { Class: { select: { teacherId: true, subject: true } } },
    });
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.Class.teacherId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (meeting.liveStatus === "LIVE") {
      return NextResponse.json({ error: "Session already live" }, { status: 400 });
    }
    if (meeting.liveStatus === "ENDED") {
      return NextResponse.json({ error: "Session already ended" }, { status: 400 });
    }

    const date = meeting.startsAt.toISOString().slice(0, 10);
    const period = meeting.periodName ?? "class";
    const jitsiRoomId = generateJitsiRoomId(meeting.classId, date, period);
    const joinUrl = buildJoinUrl(jitsiRoomId);

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        liveStatus: "LIVE",
        startedAt: new Date(),
        hostUserId: user.id,
        jitsiRoomId,
        joinUrl,
      },
    });

    void logAudit({
      userId: user.id,
      action: "meeting.started",
      resourceType: "Meeting",
      resourceId: meetingId,
      schoolId: user.schoolId,
    });

    const subjectLabel = (meeting.subject ?? meeting.Class.subject ?? "").toString().replace(/_/g, " ");
    void sendPushToClass(meeting.classId, {
      title: "Class is Live Now 🔴",
      body: `${subjectLabel} class has started. Join now.`,
      url: `/student/live/${meetingId}`,
    });

    // Guardian push — notify guardians of enrolled students (fire-and-forget)
    void (async () => {
      try {
        const enrollments = await prisma.enrollment.findMany({
          where: { classId: meeting.classId },
          select: {
            Student: {
              select: {
                user: { select: { name: true } },
                guardians: { select: { guardianId: true } },
              },
            },
          },
        });
        for (const enrollment of enrollments) {
          const guardianIds = enrollment.Student.guardians.map((g: { guardianId: string }) => g.guardianId);
          if (!guardianIds.length) continue;
          const childFirstName = enrollment.Student.user.name?.split(" ")[0] ?? "your child";
          await sendPushToMany(guardianIds, {
            title: "Live Class Started 🔴",
            body: `${childFirstName}'s ${subjectLabel} class is live now`,
            url: "/guardian/attendance",
          }).catch(() => null);
        }
      } catch {
        // Fire-and-forget — silent fail
      }
    })();

    return NextResponse.json({ joinUrl: updated.joinUrl, jitsiRoomId: updated.jitsiRoomId });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
