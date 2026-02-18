import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { attendanceAbsent, lessonCompleted, teacherFlag, weeklyReport } from "@/lib/notification-messages";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { studentId, type, meta } = await req.json();

    if (!studentId || !type) {
      return NextResponse.json({ error: "studentId and type required" }, { status: 400 });
    }

    // Find student and their guardian
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, schoolId: true } },
        guardians: {
          include: {
            guardian: {
              select: {
                id: true, guardianPhoneE164: true, preferredChannel: true,
                smsOptIn: true, email: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Tenant isolation
    if (student.user.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const guardian = student.guardians[0]?.guardian;
    if (!guardian) {
      return NextResponse.json({ sent: false, channel: "SKIPPED", reason: "No guardian linked" });
    }

    // Check opt-in
    if (!guardian.smsOptIn || !["SMS", "BOTH"].includes(guardian.preferredChannel)) {
      return NextResponse.json({ sent: false, channel: "SKIPPED", reason: "SMS opt-out or email-only" });
    }

    if (!guardian.guardianPhoneE164) {
      return NextResponse.json({ sent: false, channel: "SKIPPED", reason: "No phone number" });
    }

    // Build message
    const studentName = student.user.name || "Your child";
    let message = "";
    switch (type) {
      case "absence":
        message = attendanceAbsent(studentName, meta?.date || new Date().toLocaleDateString());
        break;
      case "completion":
        message = lessonCompleted(studentName, meta?.lessonTitle || "a lesson");
        break;
      case "flag":
        message = teacherFlag(studentName, meta?.note || "needs attention");
        break;
      case "weekly":
        message = weeklyReport(studentName, meta?.completed || 0, meta?.total || 0);
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Send SMS
    const result = await sendSMS(guardian.guardianPhoneE164, message);

    // Log notification
    await prisma.notificationLog.create({
      data: {
        userId: guardian.id,
        channel: "sms",
        recipient: guardian.guardianPhoneE164,
        body: message,
        status: result.ok ? "sent" : "failed",
        error: result.error || null,
      },
    });

    await logAudit({
      userId: user.id,
      action: "notification.guardian_sms",
      resourceType: "student",
      resourceId: studentId,
      details: { type, sent: result.ok } as any,
    });

    return NextResponse.json({
      sent: result.ok,
      channel: "SMS",
      reason: result.error || undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
