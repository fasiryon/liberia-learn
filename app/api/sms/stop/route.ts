/**
 * app/api/sms/stop/route.ts
 *
 * STOP reply handler for Africa's Talking / Twilio inbound SMS callbacks.
 *
 * When a guardian replies "STOP" (or UNSUBSCRIBE/OPTOUT/CANCEL/END/QUIT):
 *  1. Find the guardian by their E.164 phone number.
 *  2. Set smsOptIn = false on their User record.
 *  3. Upsert a GuardianConsent record with smsOptIn = false and optedOutAt.
 *  4. Log to audit trail.
 *
 * The endpoint accepts POST with JSON or form-encoded body (AT/Twilio callback
 * formats differ). No authentication required — validated by phone match.
 *
 * Rate-limited at the infrastructure level; no per-user auth needed for STOP.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";

const STOP_KEYWORDS = new Set([
  "stop", "unsubscribe", "optout", "opt-out", "cancel", "end", "quit",
]);

function isStopMessage(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(ip, { windowMs: 60_000, limit: 20, namespace: "sms-stop" });
  if (!rl.allowed) return rateLimitExceededResponse(rl);

  let phone: string | null = null;
  let messageBody: string | null = null;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const json = await request.json();
      phone = json.from ?? json.From ?? json.phone ?? null;
      messageBody = json.body ?? json.Body ?? json.text ?? null;
    } else {
      // application/x-www-form-urlencoded (Twilio / AT default)
      const form = await request.formData();
      phone = (form.get("From") ?? form.get("from") ?? form.get("phone") ?? "")
        .toString()
        .trim() || null;
      messageBody = (form.get("Body") ?? form.get("body") ?? form.get("text") ?? "")
        .toString()
        .trim() || null;
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!phone || !messageBody) {
    return NextResponse.json({ error: "Missing from or body" }, { status: 400 });
  }

  if (!isStopMessage(messageBody)) {
    // Not a STOP — acknowledge but take no action
    return NextResponse.json({ received: true });
  }

  try {
    // Find guardian by E.164 phone
    const guardian = await prisma.user.findFirst({
      where: { guardianPhoneE164: phone },
      select: {
        id: true,
        schoolId: true,
        guardianOf: {
          select: { studentId: true },
          take: 1,
        },
      },
    });

    if (!guardian) {
      // No matching guardian — log and return 200 to stop retries
      void logAudit({
        action: "sms.stop.unmatched_phone",
        details: { phone: phone.slice(0, 4) + "****" },
      });
      return NextResponse.json({ received: true });
    }

    // Opt the guardian out
    await prisma.user.update({
      where: { id: guardian.id },
      data: { smsOptIn: false },
    });

    // Upsert GuardianConsent if we can resolve a student
    const studentId = guardian.guardianOf[0]?.studentId;
    if (studentId && guardian.schoolId) {
      await prisma.guardianConsent.upsert({
        where: {
          GuardianConsent_schoolId_studentId_guardianId_key: {
            schoolId: guardian.schoolId,
            studentId,
            guardianId: guardian.id,
          },
        },
        update: {
          smsOptIn: false,
          optedOutAt: new Date(),
        },
        create: {
          schoolId: guardian.schoolId,
          studentId,
          guardianId: guardian.id,
          smsOptIn: false,
          optedOutAt: new Date(),
        },
      });
    }

    void logAudit({
      action: "sms.stop.opted_out",
      resourceType: "User",
      resourceId: guardian.id,
      schoolId: guardian.schoolId ?? null,
      details: {
        phone: phone.slice(0, 4) + "****",
        studentId: studentId ?? null,
      },
    });

    return NextResponse.json({ received: true, optedOut: true });
  } catch (err) {
    // Log error but always return 200 to prevent provider retries
    void logAudit({
      action: "sms.stop.error",
      details: {
        error: err instanceof Error ? err.message : String(err),
        phone: phone?.slice(0, 4) + "****",
      },
    });
    return NextResponse.json({ received: true });
  }
}
