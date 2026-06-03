import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import type { GuardianMessageType } from "@/lib/guardian/sms-templates";
import { logger } from "@/lib/logger";

export type SmsDeliveryInput = {
  schoolId: string;
  studentId: string;
  guardianId: string;
  messageType: GuardianMessageType;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  eventId?: string | null;
};

export type SmsDeliveryResult =
  | { ok: true; status: string; deliveryLogId: string; idempotent?: boolean }
  | { ok: false; error: string };

/**
 * Send an SMS notification and return a structured result.
 * Never throws — the admin UI receives "Failed to send" instead of a stack trace.
 *
 * Idempotency is enforced via the DB unique index on
 * (guardianId, messageType, idempotencyKey).
 */
export async function sendSmsDelivery(
  input: SmsDeliveryInput
): Promise<SmsDeliveryResult> {
  try {
    const result = await sendGuardianSMS({
      schoolId: input.schoolId,
      studentId: input.studentId,
      guardianId: input.guardianId,
      messageType: input.messageType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey ?? undefined,
      actorUserId: input.actorUserId ?? undefined,
      eventId: input.eventId ?? undefined,
    });
    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send";
    logger.error("[smsDelivery] send failed", {
      error: message,
      guardianId: input.guardianId,
      messageType: input.messageType,
    });
    return { ok: false, error: "Failed to send" };
  }
}
