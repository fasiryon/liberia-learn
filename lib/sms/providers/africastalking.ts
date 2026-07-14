/**
 * lib/sms/providers/africastalking.ts
 *
 * Extracted from an inline branch that used to live in lib/sms.ts (Sprint
 * 6.1 Finding 2 cleanup - "small cleanup, not a rebuild"). Purely a
 * structural fix: same behavior, now implementing SMSProvider like every
 * other provider so it slots into the same selection logic instead of being
 * special-cased.
 *
 * IMPORTANT: Africa's Talking does not support Liberia (confirmed against
 * their published country-coverage list, 2026-07-13 - see
 * docs/agents/GUARDIAN_COST_ACCOUNTING.md). This provider is unreachable for
 * this pilot's actual traffic (no Liberia AT credentials can exist) and is
 * kept only because AT_API_KEY/AT_USERNAME are already a checked env
 * convention elsewhere in the app (health checks, env validation) - not
 * because AT is a real option for this deployment.
 */
import type { SMSProvider, SMSProviderNormalizedError, SMSProviderSendParams, SMSProviderSendResult } from "@/lib/sms/provider";

type AtRecipient = { statusCode?: number; messageId?: string; status?: string };
type AtSendFn = (params: { to: string[]; message: string; from?: string }) => Promise<{
  SMSMessageData?: { Recipients?: AtRecipient[] };
}>;

function hasAfricasTalkingConfig() {
  return Boolean(
    (process.env.AT_API_KEY ?? process.env.AFRICA_TALKING_API_KEY)?.trim() &&
      (process.env.AT_USERNAME ?? process.env.AFRICA_TALKING_USERNAME)?.trim()
  );
}

export class AfricasTalkingSMSProvider implements SMSProvider {
  name = "africastalking";

  /** `sendFn` is injectable for tests - avoids ever needing to mock the
   * dynamically-`require`'d SDK or hit its real API. */
  constructor(private deps?: { sendFn?: AtSendFn }) {}

  normalizeError(error: unknown): SMSProviderNormalizedError {
    const raw = error instanceof Error ? error.message : String(error ?? "unknown_error");
    const retryable = /timeout|network|socket|429|5\d\d|temporar/i.test(raw);
    return { message: raw, retryable };
  }

  static isConfigured(): boolean {
    return hasAfricasTalkingConfig();
  }

  private buildDefaultSendFn(): AtSendFn {
    const apiKey = (process.env.AT_API_KEY ?? process.env.AFRICA_TALKING_API_KEY)?.trim();
    const username = (process.env.AT_USERNAME ?? process.env.AFRICA_TALKING_USERNAME)?.trim();
    if (!apiKey || !username) {
      throw new Error("Africa's Talking credentials not configured");
    }
    const AfricaTalking = require("africastalking");
    const client = AfricaTalking({ apiKey, username });
    return (params) => client.SMS.send(params);
  }

  async send(input: SMSProviderSendParams): Promise<SMSProviderSendResult> {
    try {
      const sendFn = this.deps?.sendFn ?? this.buildDefaultSendFn();
      const response = await sendFn({
        to: [input.to],
        message: input.body,
        ...(process.env.AFRICA_TALKING_SENDER_ID ? { from: process.env.AFRICA_TALKING_SENDER_ID } : {}),
      });
      const recipient = response?.SMSMessageData?.Recipients?.[0];
      const statusCode = Number(recipient?.statusCode ?? 0);

      return {
        ok: statusCode < 400,
        providerMessageId: recipient?.messageId,
        error: statusCode >= 400 ? recipient?.status : undefined,
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      return { ok: false, error: normalized.message, retryable: normalized.retryable };
    }
  }
}
