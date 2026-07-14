import { prisma } from "@/lib/db";

// Prisma can generate either smsDeliveryLog or sMSDeliveryLog depending on model naming.
// Normalize to a single delegate without breaking TS builds.
function getSmsDeliveryLogDelegate() {
  const p = prisma as any;
  const delegate = p.smsDeliveryLog ?? p.sMSDeliveryLog;
  if (!delegate) {
    throw new Error("Prisma client missing SMSDeliveryLog delegate (smsDeliveryLog/sMSDeliveryLog).");
  }
  return delegate as {
    findUnique: Function;
    create: Function;
    update: Function;
    count: Function;
  };
}

import { recordMetricEvent } from "@/lib/metrics/events";
import { recordSmsSendFailure } from "@/lib/sms/failureTracking";
import { logAudit } from "@/lib/audit";
import { renderGuardianTemplate, getDefaultTemplateKey, type GuardianMessageType, type GuardianTemplateKey } from "@/lib/guardian/sms-templates";
import type { SMSProvider } from "@/lib/sms/provider";
import { selectSmsProvider } from "@/lib/sms";

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

/**
 * SMS throttle rate limit policy.
 * Controlled by feature flag SMS_THROTTLE_ENABLED (default: true).
 * Prevents guardian inbox flooding from misconfigured event triggers.
 *
 * Env vars:
 *   SMS_THROTTLE_ENABLED      — "false" to disable (default: enabled)
 *   SMS_THROTTLE_WINDOW_HOURS — rolling window length in hours (default: 24)
 *   SMS_THROTTLE_MAX_PER_WINDOW — max sent+queued messages per window (default: 3)
 */
type ThrottlePolicy = {
  enabled: boolean;
  windowHours: number;
  maxPerWindow: number;
};

type ServiceDeps = {
  provider?: SMSProvider;
  retryPolicy?: Partial<RetryPolicy>;
  throttlePolicy?: Partial<ThrottlePolicy>;
  sleep?: (ms: number) => Promise<void>;
};

const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: Number(process.env.SMS_MAX_ATTEMPTS ?? 3),
  baseBackoffMs: Number(process.env.SMS_BASE_BACKOFF_MS ?? 250),
};

const defaultThrottlePolicy: ThrottlePolicy = {
  // Default enabled — operators set SMS_THROTTLE_ENABLED=false to disable
  enabled: process.env.SMS_THROTTLE_ENABLED !== "false",
  windowHours: Number(process.env.SMS_THROTTLE_WINDOW_HOURS ?? 24),
  maxPerWindow: Number(process.env.SMS_THROTTLE_MAX_PER_WINDOW ?? 3),
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
  const provider = deps?.provider ?? selectSmsProvider();
  const retryPolicy: RetryPolicy = {
    maxAttempts: deps?.retryPolicy?.maxAttempts ?? defaultRetryPolicy.maxAttempts,
    baseBackoffMs: deps?.retryPolicy?.baseBackoffMs ?? defaultRetryPolicy.baseBackoffMs,
  };
  const throttlePolicy: ThrottlePolicy = {
    enabled: deps?.throttlePolicy?.enabled ?? defaultThrottlePolicy.enabled,
    windowHours: deps?.throttlePolicy?.windowHours ?? defaultThrottlePolicy.windowHours,
    maxPerWindow: deps?.throttlePolicy?.maxPerWindow ?? defaultThrottlePolicy.maxPerWindow,
  };
  const sleep = deps?.sleep ?? defaultSleep;
  const idempotencyKey = toIdempotencyKey(input);
  const smsDeliveryLog = getSmsDeliveryLogDelegate();

  // --- Idempotency: return existing log if already processed ---
  const existing = await smsDeliveryLog.findUnique({
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

  // --- Tenant isolation: student must belong to the claimed school ---
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

  // --- Tenant-scoped consent lookup ---
  const consent = await prisma.guardianConsent.findFirst({
    where: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      guardianId: input.guardianId,
    },
  });

  // --- Opt-out / channel / phone checks ---
  const phoneE164 = guardian.guardianPhoneE164 ?? "";
  const explicitOptOut = Boolean(consent && (!consent.smsOptIn || consent.optedOutAt));
  const channelBlocked = !["SMS", "BOTH"].includes(guardian.preferredChannel);
  const noPhone = !phoneE164;
  const fallbackOptOut = !consent && !guardian.smsOptIn;
  const optOutBlocked = explicitOptOut || fallbackOptOut || channelBlocked || noPhone;

  // --- Rate-limit throttle check (tenant-scoped; only when not already opt-out blocked) ---
  let throttled = false;
  if (!optOutBlocked && throttlePolicy.enabled) {
    const windowStart = new Date(Date.now() - throttlePolicy.windowHours * 60 * 60 * 1000);
    // Count recent sent/queued messages for this guardian within this school
    const recentCount = await smsDeliveryLog.count({
      where: {
        schoolId: input.schoolId,
        guardianId: input.guardianId,
        status: { in: ["sent", "queued"] },
        createdAt: { gte: windowStart },
      },
    });
    throttled = recentCount >= throttlePolicy.maxPerWindow;
  }

  const blocked = optOutBlocked || throttled;

  // --- Message rendering (validated before log creation) ---
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

  // --- Create delivery log with final initial status ---
  const deliveryLog = await smsDeliveryLog.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      guardianId: input.guardianId,
      phoneE164: phoneE164 || "unknown",
      messageType: input.messageType,
      templateKey: templateKey ?? null,
      payloadJson: input.payload ?? {},
      provider: provider.name,
      status: throttled
        ? "blocked"
        : optOutBlocked
          ? explicitOptOut || fallbackOptOut
            ? "opted_out"
            : "blocked"
          : "queued",
      attempts: 0,
      idempotencyKey,
      pilotOnly: true,
    },
  });

  // --- Handle blocked / throttled cases ---
  if (throttled) {
    await recordMetricEvent(
      "sms.throttled",
      {
        messageType: input.messageType,
        templateKey: templateKey ?? null,
        windowHours: throttlePolicy.windowHours,
        maxPerWindow: throttlePolicy.maxPerWindow,
      },
      {
        scope: "school",
        scopeId: input.schoolId,
        schoolId: input.schoolId,
        severity: "warning",
        kind: "counter",
        userId: input.actorUserId ?? null,
      }
    );
    return { status: "blocked" as const, deliveryLogId: deliveryLog.id };
  }

  if (optOutBlocked) {
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
    return {
      status: (explicitOptOut || fallbackOptOut ? "opted_out" : "blocked") as "opted_out" | "blocked",
      deliveryLogId: deliveryLog.id,
    };
  }

  // --- Retry send loop ---
  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
    const sendResult = await provider.send({ to: phoneE164, body: message, idempotencyKey });
    const normalizedResult = sendResult ?? { ok: false, error: "send_failed" };
    const success = Boolean(normalizedResult.ok);
    const lastError = success ? null : normalizedResult.error ?? "send_failed";

    const updated = await smsDeliveryLog.update({
      where: { id: deliveryLog.id },
      data: {
        attempts: attempt,
        status: success ? "sent" : "failed",
        providerMessageId: success ? normalizedResult.providerMessageId ?? null : undefined,
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
      void logAudit({
        userId: input.actorUserId ?? null,
        action: "sms.delivered",
        resourceType: "SMSDeliveryLog",
        resourceId: updated.id,
        schoolId: input.schoolId,
        details: {
          messageType: input.messageType,
          templateKey: templateKey ?? null,
          guardianId: input.guardianId,
          studentId: input.studentId,
          attempts: attempt,
        },
      });
      return { status: updated.status, deliveryLogId: updated.id };
    }

    const retryable = Boolean(normalizedResult.retryable);
    // Alert-and-stop (approved Orange fallback behavior): no auto-fallback
    // to another provider on failure - just the metric event + clustering
    // check below (docs/agents/ORANGE_LIBERIA_FALLBACK_BEHAVIOR.md).
    await recordSmsSendFailure(
      provider.name,
      { scope: "school", scopeId: input.schoolId, schoolId: input.schoolId, userId: input.actorUserId ?? null },
      { messageType: input.messageType, templateKey: templateKey ?? null, attempt, retryable }
    );

    if (!retryable || attempt >= retryPolicy.maxAttempts) {
      return { status: "failed" as const, deliveryLogId: updated.id };
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

  return { status: "failed" as const, deliveryLogId: deliveryLog.id };
}
