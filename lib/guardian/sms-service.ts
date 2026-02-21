import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import { renderGuardianTemplate, getDefaultTemplateKey, type GuardianMessageType, type GuardianTemplateKey } from "@/lib/guardian/sms-templates";
import type { SMSProvider } from "@/lib/sms/provider";
import { TwilioSMSProvider } from "@/lib/sms/twilio-provider";

type SendGuardianSMSInput = {
  schoolId: string;
  studentId: string;
  guardianId: string;
  messageType: GuardianMessageType;
  templateKey?: GuardianTemplateKey | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  eventId?: string | null;
};

type RetryPolicy = {
  maxAttempts: number;
  baseBackoffMs: number;
};

type ServiceDeps = {
  provider?: SMSProvider;
  retryPolicy?: Partial<RetryPolicy>;
  sleep?: (ms: number) => Promise<void>;
};

const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: Number(process.env.SMS_MAX_ATTEMPTS ?? 3),
  baseBackoffMs: Number(process.env.SMS_BASE_BACKOFF_MS ?? 250),
};

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function toIdempotencyKey(input: SendGuardianSMSInput) {
  if (input.idempotencyKey && input.idempotencyKey.trim()) return input.idempotencyKey.trim();
  if (input.eventId && input.eventId.trim()) return input.eventId.trim();
  return `${input.studentId}:${input.guardianId}:${input.messageType}:${JSON.stringify(input.payload ?? {})}`;
}

export async function sendGuardianSMS(input: SendGuardianSMSInput, deps?: ServiceDeps) {
  const provider = deps?.provider ?? new TwilioSMSProvider();
  const retryPolicy: RetryPolicy = {
    maxAttempts: deps?.retryPolicy?.maxAttempts ?? defaultRetryPolicy.maxAttempts,
    baseBackoffMs: deps?.retryPolicy?.baseBackoffMs ?? defaultRetryPolicy.baseBackoffMs,
  };
  const sleep = deps?.sleep ?? defaultSleep;
  const idempotencyKey = toIdempotencyKey(input);

  const existing = await prisma.smsDeliveryLog.findUnique({
    where: {
      guardianId_messageType_idempotencyKey: {
        guardianId: input.guardianId,
        messageType: input.messageType,
        idempotencyKey,
      },
    },
  });
  if (existing) {
    return { status: existing.status, deliveryLogId: existing.id, idempotent: true };
  }

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: {
      user: { select: { name: true, schoolId: true } },
      guardians: {
        where: { guardianId: input.guardianId },
        include: {
          guardian: {
            select: {
              id: true,
              guardianPhoneE164: true,
              preferredChannel: true,
              smsOptIn: true,
            },
          },
        },
      },
    },
  });

  if (!student || student.user.schoolId !== input.schoolId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const link = student.guardians[0];
  if (!link) throw Object.assign(new Error("Guardian not linked to student"), { status: 404 });
  const guardian = link.guardian;

  const consent = await prisma.guardianConsent.findUnique({
    where: {
      schoolId_studentId_guardianId: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        guardianId: input.guardianId,
      },
    },
  });

  const phoneE164 = guardian.guardianPhoneE164 ?? "";
  const explicitOptOut = Boolean(consent && (!consent.smsOptIn || consent.optedOutAt));
  const channelBlocked = !["SMS", "BOTH"].includes(guardian.preferredChannel);
  const noPhone = !phoneE164;
  const fallbackOptOut = !consent && !guardian.smsOptIn;
  const blocked = explicitOptOut || fallbackOptOut || channelBlocked || noPhone;

  const templateKey = input.templateKey ?? getDefaultTemplateKey(input.messageType);
  const message =
    input.messageType === "custom"
      ? String(input.payload.message ?? "")
      : renderGuardianTemplate(templateKey as GuardianTemplateKey, {
          studentName: student.user.name ?? "Your child",
          ...input.payload,
        });
  if (!message || !message.trim()) {
    throw Object.assign(new Error("Message body is empty"), { status: 400 });
  }

  const deliveryLog = await prisma.smsDeliveryLog.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      guardianId: input.guardianId,
      phoneE164: phoneE164 || "unknown",
      messageType: input.messageType,
      templateKey: templateKey ?? null,
      payloadJson: input.payload ?? {},
      provider: provider.name,
      status: blocked ? (explicitOptOut || fallbackOptOut ? "opted_out" : "blocked") : "queued",
      attempts: 0,
      idempotencyKey,
      pilotOnly: true,
    },
  });

  if (blocked) {
    await recordMetricEvent(
      "sms.blocked.opted_out",
      { messageType: input.messageType, templateKey: templateKey ?? null },
      {
        scope: "school",
        scopeId: input.schoolId,
        schoolId: input.schoolId,
        severity: "warning",
        kind: "counter",
        userId: input.actorUserId ?? null,
      }
    );
    return { status: explicitOptOut || fallbackOptOut ? "opted_out" : "blocked", deliveryLogId: deliveryLog.id };
  }

  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
    const sendResult = await provider.send({ to: phoneE164, body: message, idempotencyKey });
    const success = sendResult.ok;
    const lastError = success ? null : sendResult.error ?? "send_failed";

    const updated = await prisma.smsDeliveryLog.update({
      where: { id: deliveryLog.id },
      data: {
        attempts: attempt,
        status: success ? "sent" : "failed",
        providerMessageId: success ? sendResult.providerMessageId ?? null : undefined,
        lastError,
      },
    });

    if (success) {
      await recordMetricEvent(
        "sms.sent",
        { messageType: input.messageType, templateKey: templateKey ?? null, attempts: attempt },
        {
          scope: "school",
          scopeId: input.schoolId,
          schoolId: input.schoolId,
          severity: "info",
          kind: "counter",
          userId: input.actorUserId ?? null,
        }
      );
      return { status: updated.status, deliveryLogId: updated.id };
    }

    const retryable = Boolean(sendResult.retryable);
    await recordMetricEvent(
      "sms.failed",
      { messageType: input.messageType, templateKey: templateKey ?? null, attempt, retryable },
      {
        scope: "school",
        scopeId: input.schoolId,
        schoolId: input.schoolId,
        severity: "error",
        kind: "counter",
        userId: input.actorUserId ?? null,
      }
    );

    if (!retryable || attempt >= retryPolicy.maxAttempts) {
      return { status: "failed", deliveryLogId: updated.id };
    }

    await recordMetricEvent(
      "sms.retry",
      { messageType: input.messageType, templateKey: templateKey ?? null, attempt },
      {
        scope: "school",
        scopeId: input.schoolId,
        schoolId: input.schoolId,
        severity: "warning",
        kind: "counter",
        userId: input.actorUserId ?? null,
      }
    );
    const backoffMs = retryPolicy.baseBackoffMs * Math.pow(2, Math.max(0, attempt - 1));
    await sleep(backoffMs);
  }

  return { status: "failed", deliveryLogId: deliveryLog.id };
}


