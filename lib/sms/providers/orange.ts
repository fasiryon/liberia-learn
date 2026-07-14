/**
 * lib/sms/providers/orange.ts
 *
 * Orange Liberia SMS provider (outbound only). Confirmed against Orange's
 * official developer documentation, 2026-07-14:
 * - Overview: https://developer.orange.com/apis/sms-liberia
 * - Getting started (shared regional doc): https://developer.orange.com/apis/sms/getting-started
 * - API reference: https://developer.orange.com/apis/sms/api-reference
 * - Pricing (primary source, on the Liberia overview page itself): "Bundles
 *   from 100 to 50,000 SMS: starting at 0.06$ per message", billed against
 *   prepaid airtime/communication credit (pay-as-you-go) - a different
 *   billing model than Twilio's invoiced account, worth noting for whoever
 *   manages the Orange account balance operationally.
 *
 * IMPORTANT - INBOUND NOT CONFIRMED: this API's documentation (overview,
 * getting-started, API reference, FAQ - four separate official pages)
 * describes only outbound sending and delivery-status callbacks
 * (`deliveryInfoNotification`, which reports DeliveredToNetwork/
 * DeliveryImpossible/etc. for a message YOU sent - not an inbound message
 * FROM a guardian). No mobile-originated (MO) / inbound-SMS endpoint or
 * webhook format is documented anywhere in those four pages, despite a
 * secondary search-engine snippet suggesting Orange's broader product
 * family supports "SMS MO". This provider is therefore OUTBOUND-ONLY until
 * that is confirmed directly with Orange developer support (requires an
 * authenticated developer-portal account to submit their contact form - a
 * business step outside what this integration can do on its own). Do not
 * build an inbound webhook handler for Orange until that answer comes back.
 */
import type { SMSProvider, SMSProviderNormalizedError, SMSProviderSendParams, SMSProviderSendResult } from "@/lib/sms/provider";

const TOKEN_URL = "https://api.orange.com/oauth/v3/token";
const SEND_URL_BASE = "https://api.orange.com/smsmessaging/v1/outbound";

type FetchLike = typeof fetch;

interface OrangeToken {
  accessToken: string;
  expiresAt: number; // ms epoch
}

function hasOrangeConfig() {
  return Boolean(
    process.env.ORANGE_CLIENT_ID?.trim() &&
      process.env.ORANGE_CLIENT_SECRET?.trim() &&
      process.env.ORANGE_SENDER_NUMBER?.trim()
  );
}

/** Strips a leading "+" - Orange's URL path wants the bare country-code number. */
function bareNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

export class OrangeSMSProvider implements SMSProvider {
  name = "orange";
  private cachedToken: OrangeToken | null = null;

  /** `fetchImpl` and `now` are injectable for tests - never hits the real
   * Orange API or depends on wall-clock time for token-expiry tests. */
  constructor(private deps?: { fetchImpl?: FetchLike; now?: () => number }) {}

  normalizeError(error: unknown): SMSProviderNormalizedError {
    const raw = error instanceof Error ? error.message : String(error ?? "unknown_error");
    const retryable = /timeout|network|socket|429|5\d\d|temporar/i.test(raw);
    return { message: raw, retryable };
  }

  static isConfigured(): boolean {
    return hasOrangeConfig();
  }

  private fetchImpl(): FetchLike {
    return this.deps?.fetchImpl ?? fetch;
  }

  private now(): number {
    return this.deps?.now?.() ?? Date.now();
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > this.now()) {
      return this.cachedToken.accessToken;
    }

    const clientId = process.env.ORANGE_CLIENT_ID?.trim();
    const clientSecret = process.env.ORANGE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("Orange Liberia credentials not configured");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await this.fetchImpl()(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      throw new Error(`Orange token request failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: string | number };
    if (!data.access_token) {
      throw new Error("Orange token response missing access_token");
    }

    // expires_in is seconds (documented as "3600"); refresh 60s early as margin.
    const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
    this.cachedToken = { accessToken: data.access_token, expiresAt: this.now() + expiresInMs - 60_000 };
    return this.cachedToken.accessToken;
  }

  async send(input: SMSProviderSendParams): Promise<SMSProviderSendResult> {
    try {
      const senderNumber = process.env.ORANGE_SENDER_NUMBER?.trim();
      if (!senderNumber) {
        throw new Error("Orange Liberia credentials not configured");
      }

      const accessToken = await this.getAccessToken();
      const url = `${SEND_URL_BASE}/tel%3A%2B${bareNumber(senderNumber)}/requests`;

      const res = await this.fetchImpl()(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: `tel:+${bareNumber(input.to)}`,
            senderAddress: `tel:+${bareNumber(senderNumber)}`,
            outboundSMSTextMessage: { message: input.body },
          },
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        outboundSMSMessageRequest?: { resourceURL?: string };
      } | null;

      if (!res.ok) {
        return {
          ok: false,
          error: `HTTP ${res.status}`,
          retryable: res.status >= 500 || res.status === 429,
        };
      }

      const resourceURL = data?.outboundSMSMessageRequest?.resourceURL;
      const providerMessageId = resourceURL?.split("/requests/")[1];

      return { ok: true, providerMessageId };
    } catch (error) {
      const normalized = this.normalizeError(error);
      return { ok: false, error: normalized.message, retryable: normalized.retryable };
    }
  }
}
