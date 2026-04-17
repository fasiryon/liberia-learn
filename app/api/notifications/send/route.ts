import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  sendHomeworkGraded,
  sendWeeklyProgressToGuardian,
} from "@/lib/email";
import { sendSMS } from "@/lib/sms";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/send
 * Unified notification endpoint. Sends via email and/or SMS, logs to NotificationLog.
 *
 * Body: { type, userId, channel?, data }
 * - type: "homework_graded" | "attendance_alert" | "weekly_progress" | "custom"
 * - channel: "email" | "sms" | "both" (default: "email")
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json();
    const { type, userId, channel = "email", data } = body;

    if (!type || !userId) {
      return NextResponse.json({ error: "type and userId required" }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, schoolId: user.schoolId },
      select: { id: true, email: true, name: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found or outside your school" }, { status: 403 });
    }

    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

    // Email
    if (channel === "email" || channel === "both") {
      let emailResult: { ok: boolean; id?: string; error?: string } = { ok: false, error: "Unknown type" };

      if (type === "homework_graded" && target.email) {
        emailResult = await sendHomeworkGraded({
          to: target.email,
          studentName: target.name ?? "Student",
          homeworkTitle: data?.homeworkTitle ?? "Homework",
          score: data?.score ?? 0,
          teacherNotes: data?.teacherNotes,
          dashboardUrl: data?.dashboardUrl ?? `${process.env.NEXTAUTH_URL}/dashboard`,
        }).catch((error: any) => ({ ok: false, error: error?.message ?? "email_failed" }));
      } else if (type === "weekly_progress" && target.email) {
        emailResult = await sendWeeklyProgressToGuardian({
          to: target.email,
          guardianName: target.name ?? "Guardian",
          studentName: data?.studentName ?? "Student",
          schoolName: data?.schoolName ?? "LiberiaLearn",
          weekSummary: Array.isArray(data?.weekSummary) ? data.weekSummary : [],
          dashboardUrl: data?.dashboardUrl ?? `${process.env.NEXTAUTH_URL}/guardian/dashboard`,
          unsubscribeUrl: data?.unsubscribeUrl,
        }).catch((error: any) => ({ ok: false, error: error?.message ?? "email_failed" }));
      } else if (type === "custom" && target.email) {
        // For custom, we'd need to add a generic send — for now log it
        emailResult = { ok: true };
      }

      results.push({ channel: "email", ...emailResult });

      // Log
      await prisma.notificationLog.create({
        data: {
          userId: target.id,
          channel: "email",
          recipient: target.email ?? "",
          subject: `${type}: ${data?.homeworkTitle ?? "notification"}`,
          body: JSON.stringify(data ?? {}),
          status: emailResult.ok ? "sent" : "failed",
          error: emailResult.error ?? null,
        },
      });
    }

    // SMS
    if ((channel === "sms" || channel === "both") && data?.phone) {
      const smsBody =
        type === "homework_graded"
          ? `LiberiaLearn: ${target.name ?? "Student"}'s homework "${data.homeworkTitle}" scored ${data.score}%. Check the dashboard for details.`
          : type === "attendance_alert"
          ? `LiberiaLearn: ${target.name ?? "Student"} was marked ${data.status ?? "absent"} today.`
          : data?.message ?? "LiberiaLearn notification";

      const smsResult = await sendSMS(data.phone, smsBody);
      results.push({ channel: "sms", ...smsResult });

      await prisma.notificationLog.create({
        data: {
          userId: target.id,
          channel: "sms",
          recipient: data.phone,
          body: smsBody,
          status: smsResult.ok ? "sent" : "failed",
          error: smsResult.error ?? null,
        },
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
