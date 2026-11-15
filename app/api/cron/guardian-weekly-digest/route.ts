import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import { composeGuardianDigest, mostRecentWeekWindow } from "@/lib/notifications/guardianDigest";
import { logger } from "@/lib/logger";
import {previewAutomationDisabled} from "@/lib/previewSideEffects";

// route-policy: auth=cron; scope=none; authority=required-header-secret; rationale=Preview refuses all work and missing or blank CRON_SECRET never authorizes SMS or database work.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if(previewAutomationDisabled())return NextResponse.json({error:"Preview automation is disabled"},{status:401});
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret?.trim() || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart, weekEnd } = mostRecentWeekWindow(new Date());
  logger.info("[guardian-weekly-digest] cron start", {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });

  // Find active guardians: phone set, smsOptIn, channel allows SMS
  const guardians = await prisma.user.findMany({
    where: {
      guardianPhoneE164: { not: null },
      smsOptIn: true,
      preferredChannel: { in: ["SMS", "BOTH"] },
      guardianOf: { some: {} },
    },
    select: {
      id: true,
      guardianOf: { select: { studentId: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const guardian of guardians) {
    const studentIds = guardian.guardianOf.map((sg) => sg.studentId);
    if (!studentIds.length) { skipped++; continue; }

    try {
      const result = await composeGuardianDigest({
        guardianId: guardian.id,
        studentIds,
        weekStart,
        weekEnd,
      });

      if (!result) { skipped++; continue; }

      const idempotencyKey = `weekly-digest:${guardian.id}:${weekStart.toISOString().slice(0, 10)}`;

      await sendGuardianSMS(
        {
          schoolId: result.schoolId,
          studentId: result.primaryStudentId,
          guardianId: guardian.id,
          messageType: "weekly_digest",
          payload: { ...result.metrics, studentName: result.studentFirstName, actionTip: result.metrics.actionTip },
          idempotencyKey,
        },
        // Disable throttle — scheduled weekly digest is not a flooding risk
        { throttlePolicy: { enabled: false } }
      );

      sent++;
    } catch (err) {
      errors++;
      logger.error("[guardian-weekly-digest] send failed", {
        guardianId: guardian.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[guardian-weekly-digest] cron complete", { sent, skipped, errors });
  return NextResponse.json({ ok: true, sent, skipped, errors });
}
