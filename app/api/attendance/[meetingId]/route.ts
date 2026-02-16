// app/api/attendance/[meetingId]/route.ts
import { NextResponse } from "next/server";
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
    const { meetingId } = params;

    const body = await req.json();
    const parsed = Schema.parse(body);

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
