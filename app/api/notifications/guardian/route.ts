import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { attendanceAbsent, lessonCompleted, teacherFlag, weeklyReport } from "@/lib/notification-messages";
import { logAudit } from "@/lib/audit";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";

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

    // Build message
    const studentName = student.user.name || "Your child";
    let messageType: "absence" | "at_risk" | "praise" | "custom" = "custom";
    let payload: Record<string, unknown> = {};
    let templateKey: "absence" | "at_risk" | "praise" | null = null;
    switch (type) {
      case "absence":
        messageType = "absence";
        templateKey = "absence";
        payload = { studentName, date: meta?.date || new Date().toLocaleDateString() };
        break;
      case "completion":
        messageType = "praise";
        templateKey = "praise";
        payload = { studentName, achievement: `completed ${meta?.lessonTitle || "a lesson"}` };
        break;
      case "flag":
        messageType = "at_risk";
        templateKey = "at_risk";
        payload = { studentName, note: meta?.note || "needs attention" };
        break;
      case "weekly":
        messageType = "custom";
        payload = {
          message: weeklyReport(studentName, meta?.completed || 0, meta?.total || 0),
          studentName,
        };
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const messagePreview =
      type === "absence"
        ? attendanceAbsent(studentName, String(payload.date ?? ""))
        : type === "completion"
        ? lessonCompleted(studentName, String(meta?.lessonTitle || "a lesson"))
        : type === "flag"
        ? teacherFlag(studentName, String(meta?.note || "needs attention"))
        : weeklyReport(studentName, Number(meta?.completed || 0), Number(meta?.total || 0));

    const result = await sendGuardianSMS({
      schoolId: user.schoolId ?? "",
      studentId: student.id,
      guardianId: guardian.id,
      messageType,
      templateKey,
      payload,
      actorUserId: user.id,
      idempotencyKey: `${type}:${student.id}:${meta?.eventId ?? ""}:${meta?.date ?? ""}:${meta?.lessonTitle ?? ""}`,
      eventId: meta?.eventId ?? null,
    });

    await prisma.notificationLog.create({
      data: {
        userId: guardian.id,
        channel: "sms",
        recipient: guardian.guardianPhoneE164 ?? "",
        body: messagePreview,
        status: result.status === "sent" ? "sent" : "failed",
        error: result.status === "failed" ? "provider_send_failed" : null,
      },
    });

    await logAudit({
      userId: user.id,
      action: "notification.guardian_sms",
      resourceType: "student",
      resourceId: studentId,
      details: { type, sent: result.status === "sent", deliveryLogId: result.deliveryLogId } as any,
    });

    return NextResponse.json({
      sent: result.status === "sent",
      channel: "SMS",
      reason: result.status,
      deliveryLogId: result.deliveryLogId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

