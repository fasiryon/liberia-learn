import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const classes = await prisma.class.findMany({
      where: { teacherId: user.id },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);

    const where: Record<string, unknown> = { classId: { in: classIds } };
    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      where.startsAt = { gte: start, lte: end };
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        _count: { select: { attendees: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({ meetings: meetings.map((m) => ({ ...m, attendeeCount: m._count.attendees })) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json();
    const { classId, scheduledDate, periodName, subject } = body as {
      classId: string;
      scheduledDate: string;
      periodName: string;
      subject?: string;
    };

    if (!classId || !scheduledDate || !periodName) {
      return NextResponse.json({ error: "classId, scheduledDate, and periodName are required" }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({
      where: { id: classId, teacherId: user.id },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found or not yours" }, { status: 403 });
    }

    const date = new Date(scheduledDate);
    date.setUTCHours(8, 0, 0, 0);

    const meeting = await prisma.meeting.create({
      data: {
        classId,
        subject: subject ?? cls.subject,
        periodName,
        startsAt: date,
        endsAt: new Date(date.getTime() + 45 * 60 * 1000),
        liveStatus: "SCHEDULED",
      },
    });

    void logAudit({ userId: user.id, action: "meeting.created", resourceType: "Meeting", resourceId: meeting.id, schoolId: user.schoolId });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
