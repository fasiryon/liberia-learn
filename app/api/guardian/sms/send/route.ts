import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import type { GuardianMessageType, GuardianTemplateKey } from "@/lib/guardian/sms-templates";

const SendSMSSchema = z.object({
  studentId: z.string().min(1),
  guardianId: z.string().min(1),
  messageType: z.string().min(1),
  templateKey: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "Missing schoolId" }, { status: 400 });
    }

    const rawBody = await req.json().catch(() => null);
    const validation = SendSMSSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, guardianId, messageType, templateKey, payload, idempotencyKey, eventId } = validation.data;

    const result = await sendGuardianSMS({
      schoolId: user.schoolId,
      studentId,
      guardianId,
      messageType: messageType as GuardianMessageType,
      templateKey: (templateKey ?? null) as GuardianTemplateKey | null,
      payload,
      idempotencyKey: idempotencyKey ?? null,
      eventId: eventId ?? null,
      actorUserId: user.id,
    });

    return NextResponse.json({
      status: result.status,
      deliveryLogId: result.deliveryLogId,
      idempotent: result.idempotent ?? false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

