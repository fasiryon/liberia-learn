import type { SMSProvider, SMSProviderNormalizedError, SMSProviderSendParams, SMSProviderSendResult } from "@/lib/sms/provider";

function hasTwilioConfig() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

function devBypassAllowed() {
  return process.env.NODE_ENV !== "production";
}

export class TwilioSMSProvider implements SMSProvider {
  name = "twilio";

  normalizeError(error: unknown): SMSProviderNormalizedError {
    const raw = error instanceof Error ? error.message : String(error ?? "unknown_error");
    const retryable = /timeout|network|socket|429|5\d\d|temporar/i.test(raw);
    return { message: raw, retryable };
  }

  async send(input: SMSProviderSendParams): Promise<SMSProviderSendResult> {
    if (process.env.NODE_ENV === "test") {
      console.log(`[SMS-DEV] To: ${input.to} | Body: ${input.body}`);
      return { ok: true, providerMessageId: "dev-no-send" };
    }
    if (!hasTwilioConfig()) {
      if (devBypassAllowed()) {
        console.log(`[SMS-DEV] To: ${input.to} | Body: ${input.body}`);
        return { ok: true, providerMessageId: "dev-no-send" };
      }
      return { ok: false, error: "Twilio config missing", retryable: false };
    }

    try {
      const sid = process.env.TWILIO_ACCOUNT_SID as string;
      const auth = process.env.TWILIO_AUTH_TOKEN as string;
      const from = process.env.TWILIO_PHONE_NUMBER as string;

      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const token = Buffer.from(`${sid}:${auth}`).toString("base64");
      const params = new URLSearchParams();
      params.set("To", input.to);
      params.set("From", from);
      params.set("Body", input.body);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data?.message ?? `HTTP ${res.status}`,
          retryable: res.status >= 500 || res.status === 429,
        };
      }
      return { ok: true, providerMessageId: data?.sid };
    } catch (err) {
      const normalized = this.normalizeError(err);
      return { ok: false, error: normalized.message, retryable: normalized.retryable };
    }
  }
}

