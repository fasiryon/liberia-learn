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

    const [totalToday, studentToTeacher, teacherToStudent, guardianToTeacher] = await Promise.all([
      // Total student↔teacher messages today
      prisma.message.count({
        where: { createdAt: { gte: todayStart }, senderRole: { in: ["STUDENT", "TEACHER"] }, ...schoolFilter },
      }),
      // Student → Teacher today
      prisma.message.count({
        where: { createdAt: { gte: todayStart }, senderRole: "STUDENT", ...schoolFilter },
      }),
      // Teacher → Student today
      prisma.message.count({
        where: { createdAt: { gte: todayStart }, senderRole: "TEACHER", recipientRole: "STUDENT", ...schoolFilter },
      }),
      // Guardian → Teacher today (GuardianMessage)
      prisma.guardianMessage.count({
        where: {
          sentAt: { gte: todayStart },
          fromRole: "guardian",
          ...(user.isPlatformAdmin ? {} : { school: { id: user.schoolId ?? "" } }),
        },
      }),
    ]);

    // Aggregate totals (no message bodies returned)
    return NextResponse.json({
      totalToday,
      studentToTeacher,
      teacherToStudent,
      guardianToTeacher,
      flaggedMessages: 0, // flag system not yet implemented
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
