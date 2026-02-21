import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json();
    const {
      studentId,
      guardianId,
      messageType,
      templateKey,
      payload,
      idempotencyKey,
      eventId,
    } = body ?? {};

    if (!studentId || !guardianId || !messageType || payload == null) {
      return NextResponse.json(
        { error: "studentId, guardianId, messageType, payload are required" },
        { status: 400 }
      );
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "Missing schoolId" }, { status: 400 });
    }

    const result = await sendGuardianSMS({
      schoolId: user.schoolId,
      studentId,
      guardianId,
      messageType,
      templateKey: templateKey ?? null,
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


