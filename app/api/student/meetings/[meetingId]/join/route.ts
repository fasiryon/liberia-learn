import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const { meetingId } = params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
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

    return NextResponse.json({ joinUrl: meeting.joinUrl });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
