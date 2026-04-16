/**
 * lib/guardian/sms-notifications.ts
 *
 * Sprint 15 SMS notification dispatcher.
 *
 * All SMS sends are fire-and-forget from the HTTP request path —
 * they are dispatched via dispatchSmsNotification() which never blocks
 * the caller and handles errors internally.
 *
 * In production with SQS: replace the inner sendGuardianSMS call with
 * an SQS FIFO enqueue (MessageGroupId = guardianId, MessageDeduplicationId =
 * idempotencyKey). The worker picks it up and calls sendGuardianSMS.
 *
 * logAudit is called for every dispatched notification (fire-and-forget).
 */

import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import { logAudit } from "@/lib/audit";
import { isValidLiberianPhone } from "@/lib/sms/validators";
import { logger } from "@/lib/logger";
import type { GuardianMessageType } from "@/lib/guardian/sms-templates";

export type SmsNotificationInput = {
  schoolId: string;
  studentId: string;
  guardianId: string;
  messageType: GuardianMessageType;
  payload: Record<string, unknown>;
  /** Optional: idempotency key for dedup. Defaults to event-derived key. */
  idempotencyKey?: string;
  /** Optional: actor user ID for audit trail. */
  actorUserId?: string | null;
  /** Optional: event correlation ID. */
  eventId?: string | null;
  /**
   * Phone to validate before dispatch. When provided, the notification is
   * blocked early if the phone is not a valid Liberian E.164 number.
   */
  guardianPhone?: string | null;
};

type DispatchResult = {
  dispatched: boolean;
  reason?: string;
};

/**
 * Validate and fire-and-forget an SMS notification.
 *
 * Returns a promise that resolves immediately — the actual send happens
 * asynchronously. The caller should never await this for correctness.
 *
 * Usage inside an API route:
 *   void dispatchSmsNotification({ ... });
 */
export async function dispatchSmsNotification(
  input: SmsNotificationInput
): Promise<DispatchResult> {
  // Validate Liberian phone format when provided
  if (input.guardianPhone) {
    if (!isValidLiberianPhone(input.guardianPhone)) {
      logger.warn("[SMS] Invalid Liberian phone — notification blocked", {
        guardianId: input.guardianId,
        messageType: input.messageType,
      });
      return { dispatched: false, reason: "invalid_phone_format" };
    }
  }

  // Fire-and-forget: never throw back to caller
  void (async () => {
    try {
      const result = await sendGuardianSMS({
        schoolId: input.schoolId,
        studentId: input.studentId,
        guardianId: input.guardianId,
        messageType: input.messageType as any,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        actorUserId: input.actorUserId,
        eventId: input.eventId,
      });

      // Audit trail — fire-and-forget (logAudit has internal try/catch)
      void logAudit({
        userId: input.actorUserId ?? null,
        action: "sms.notification.dispatched",
        resourceType: "SMSDeliveryLog",
        resourceId: result.deliveryLogId,
        schoolId: input.schoolId,
        details: {
          messageType: input.messageType,
          guardianId: input.guardianId,
          studentId: input.studentId,
          status: result.status,
          idempotent: (result as any).idempotent ?? false,
        },
      });
    } catch (err) {
      logger.error("[SMS] dispatchSmsNotification: unexpected error", {
        error: err instanceof Error ? err.message : String(err),
        messageType: input.messageType,
        guardianId: input.guardianId,
      });
    }
  })();

  return { dispatched: true };
}

/**
 * Convenience wrappers for each Sprint 15 notification type.
 * All are fire-and-forget.
 */

export function sendWeeklyDigest(params: {
  schoolId: string;
  studentId: string;
  guardianId: string;
  studentName: string;
  lessonsCompleted: number;
  avgScore: number;
  actorUserId?: string | null;
  guardianPhone?: string | null;
}) {
  return dispatchSmsNotification({
    schoolId: params.schoolId,
    studentId: params.studentId,
    guardianId: params.guardianId,
    messageType: "weekly_digest",
    payload: {
      studentName: params.studentName,
      lessonsCompleted: params.lessonsCompleted,
      avgScore: params.avgScore,
    },
    actorUserId: params.actorUserId,
    guardianPhone: params.guardianPhone,
  });
}

export function sendAssignmentDueAlert(params: {
  schoolId: string;
  studentId: string;
  guardianId: string;
  studentName: string;
  subject: string;
  dueDate: string;
  actorUserId?: string | null;
  guardianPhone?: string | null;
}) {
  return dispatchSmsNotification({
    schoolId: params.schoolId,
    studentId: params.studentId,
    guardianId: params.guardianId,
    messageType: "assignment_due",
    payload: {
      studentName: params.studentName,
      subject: params.subject,
      dueDate: params.dueDate,
    },
    actorUserId: params.actorUserId,
    guardianPhone: params.guardianPhone,
  });
}

export function sendCertificateAwardedAlert(params: {
  schoolId: string;
  studentId: string;
  guardianId: string;
  studentName: string;
  subject: string;
  certificateCode: string;
  actorUserId?: string | null;
  guardianPhone?: string | null;
}) {
  return dispatchSmsNotification({
    schoolId: params.schoolId,
    studentId: params.studentId,
    guardianId: params.guardianId,
    messageType: "certificate_awarded",
    payload: {
      studentName: params.studentName,
      subject: params.subject,
      certificateCode: params.certificateCode,
    },
    actorUserId: params.actorUserId,
    guardianPhone: params.guardianPhone,
  });
}

export function sendAtRiskAlert(params: {
  schoolId: string;
  studentId: string;
  guardianId: string;
  studentName: string;
  note: string;
  actorUserId?: string | null;
  guardianPhone?: string | null;
}) {
  return dispatchSmsNotification({
    schoolId: params.schoolId,
    studentId: params.studentId,
    guardianId: params.guardianId,
    messageType: "at_risk",
    payload: {
      studentName: params.studentName,
      note: params.note,
    },
    actorUserId: params.actorUserId,
    guardianPhone: params.guardianPhone,
  });
}
