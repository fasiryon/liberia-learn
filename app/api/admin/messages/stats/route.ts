import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const schoolFilter = user.isPlatformAdmin ? {} : { fromUser: { schoolId: user.schoolId } };

    const [totalToday, studentToTeacher, teacherToStudent, guardianToTeacher, flaggedMessages] = await Promise.all([
      prisma.message.count({
        where: { createdAt: { gte: todayStart }, senderRole: { in: ["STUDENT", "TEACHER"] }, ...schoolFilter },
      }),
      prisma.message.count({
        where: { createdAt: { gte: todayStart }, senderRole: "STUDENT", ...schoolFilter },
      }),
      prisma.message.count({
        where: { createdAt: { gte: todayStart }, senderRole: "TEACHER", recipientRole: "STUDENT", ...schoolFilter },
      }),
      prisma.guardianMessage.count({
        where: {
          sentAt: { gte: todayStart },
          fromRole: "guardian",
          ...(user.isPlatformAdmin ? {} : { school: { id: user.schoolId ?? "" } }),
        },
      }),
      // Unflagged = pending review
      prisma.message.count({
        where: {
          flagged: true,
          flagReviewedAt: null,
          ...(user.isPlatformAdmin ? {} : { fromUser: { schoolId: user.schoolId } }),
        },
      }),
    ]);

    return NextResponse.json({
      totalToday,
      studentToTeacher,
      teacherToStudent,
      guardianToTeacher,
      flaggedMessages,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
