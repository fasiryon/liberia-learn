import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import { composeGuardianDigest, mostRecentWeekWindow } from "@/lib/notifications/guardianDigest";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/digest/trigger
 * Manual trigger for guardian weekly digest — compose and optionally send.
 * Body: { guardianIds?: string[], weekStart?: string, previewOnly?: boolean }
 *
 * previewOnly: true  → return rendered smsText without sending (default: false)
 * guardianIds: []    → send to all eligible guardians
 */
export async function POST(req: Request) {
  try {
    await requireRole("ADMIN", "PLATFORM_ADMIN");

    const body = (await req.json().catch(() => ({}))) as {
      guardianIds?: string[];
      weekStart?: string;
      previewOnly?: boolean;
    };

    const previewOnly = body.previewOnly ?? false;
    const anchor = body.weekStart ? new Date(body.weekStart) : new Date();
    const { weekStart, weekEnd } = mostRecentWeekWindow(anchor);

    let guardians: { id: string; guardianOf: { studentId: string }[] }[];

    if (body.guardianIds?.length) {
      guardians = await prisma.user.findMany({
        where: { id: { in: body.guardianIds } },
        select: { id: true, guardianOf: { select: { studentId: true } } },
      });
    } else {
      guardians = await prisma.user.findMany({
        where: {
          guardianPhoneE164: { not: null },
          smsOptIn: true,
          preferredChannel: { in: ["SMS", "BOTH"] },
          guardianOf: { some: {} },
        },
        select: { id: true, guardianOf: { select: { studentId: true } } },
      });
    }

    const results: {
      guardianId: string;
      smsText: string | null;
      metrics: Record<string, unknown> | null;
      sent: boolean;
      skipped: boolean;
      error?: string;
    }[] = [];

    for (const guardian of guardians) {
      const studentIds = guardian.guardianOf.map((sg) => sg.studentId);

      try {
        const result = await composeGuardianDigest({
          guardianId: guardian.id,
          studentIds,
          weekStart,
          weekEnd,
        });

        if (!result) {
          results.push({ guardianId: guardian.id, smsText: null, metrics: null, sent: false, skipped: true });
          continue;
        }

        if (!previewOnly) {
          const idempotencyKey = `weekly-digest-manual:${guardian.id}:${weekStart.toISOString().slice(0, 10)}:${Date.now()}`;
          await sendGuardianSMS(
            {
              schoolId: result.schoolId,
              studentId: result.primaryStudentId,
              guardianId: guardian.id,
              messageType: "weekly_digest",
              payload: {
                ...result.metrics,
                studentName: result.studentFirstName,
                actionTip: result.metrics.actionTip,
              },
              idempotencyKey,
            },
            { throttlePolicy: { enabled: false } }
          );
        }

        results.push({
          guardianId: guardian.id,
          smsText: result.smsText,
          metrics: result.metrics as Record<string, unknown>,
          sent: !previewOnly,
          skipped: false,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error("[digest/trigger] error", { guardianId: guardian.id, error });
        results.push({ guardianId: guardian.id, smsText: null, metrics: null, sent: false, skipped: false, error });
      }
    }

    return NextResponse.json({ ok: true, weekStart, weekEnd, previewOnly, results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Trigger failed" }, { status: err?.status ?? 500 });
  }
}
