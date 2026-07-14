/**
 * lib/sms/providers/dry-run.ts
 *
 * Safe no-op SMS adapter used when ENABLE_LIVE_SMS is not "true".
 * Logs the intended send without making any real network call.
 * Returns ok:true so callers treat it as a successful send,
 * but the providerMessageId prefix "dry-run-" makes it auditable.
 *
 * Never fakes a delivery receipt or interacts with a live provider.
 */

import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import type {
  SMSProvider,
  SMSProviderNormalizedError,
  SMSProviderSendParams,
  SMSProviderSendResult,
} from "@/lib/sms/provider";

export class DryRunSMSProvider implements SMSProvider {
  name = "dry-run";

  normalizeError(error: unknown): SMSProviderNormalizedError {
    const message = error instanceof Error ? error.message : String(error ?? "unknown");
    return { message, retryable: false };
  }

  async send(input: SMSProviderSendParams): Promise<SMSProviderSendResult> {
    const dryRunId = `dry-run-${randomUUID()}`;
    logger.info("[SMS-DRY-RUN] SMS not sent - live SMS disabled (ENABLE_LIVE_SMS not set)", {
      to: input.to.slice(0, 4) + "****",
      bodyLength: input.body.length,
      idempotencyKey: input.idempotencyKey,
      dryRunId,
    });
    return { ok: true, providerMessageId: dryRunId };
  }
}
