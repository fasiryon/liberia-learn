import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const { meetingId } = params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { Class: { select: { id: true, schoolId: true, subject: true } } },
    });
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.liveStatus !== "LIVE") {
      return NextResponse.json({ error: "Session is not live" }, { status: 400 });
    }

    await prisma.meetingAttendee.upsert({
      where: { meetingId_userId: { meetingId, userId: user.id } },
      update: {},
      create: { meetingId, userId: user.id },
    });

    const student = await Promise.resolve(
      (prisma as any).student?.findUnique?.({ where: { userId: user.id }, select: { id: true } })
    ).catch(() => null);
    const schoolId = meeting.Class?.schoolId ?? user.schoolId ?? null;
    const classId = meeting.Class?.id ?? meeting.classId;
    await logProductSignal({
      schoolId,
      classId,
      userId: user.id,
      studentId: student?.id ?? null,
      actor: { type: "student", id: user.id, role: "STUDENT" },
      target: { type: "meeting", id: meeting.id },
      eventType: "live_session.joined",
      source: "/api/student/meetings/[meetingId]/join",
      subject: meeting.Class?.subject ? String(meeting.Class.subject) : null,
      dedupeKey: `live_session.joined:${schoolId ?? "unknown"}:${meeting.id}:${user.id}`,
      metadata: {
        liveStatus: meeting.liveStatus,
      },
    });

    return NextResponse.json({ joinUrl: meeting.joinUrl });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
