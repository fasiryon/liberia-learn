import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { enrollments: { select: { classId: true } } },
    });
    if (!student) {
      return NextResponse.json({ sessions: [] });
    }

    const classIds = student.enrollments.map((e) => e.classId);

    const sessions = await prisma.meeting.findMany({
      where: { classId: { in: classIds }, liveStatus: "LIVE" },
      select: {
        id: true,
        classId: true,
        subject: true,
        periodName: true,
        joinUrl: true,
        startedAt: true,
        Class: { select: { name: true, subject: true } },
      },
      orderBy: { startedAt: "asc" },
    });

    return NextResponse.json({ sessions });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
