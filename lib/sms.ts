// lib/sms.ts - Backward-compatible wrapper for SMS sending.
import { TwilioSMSProvider } from "@/lib/sms/twilio-provider";

export async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const provider = new TwilioSMSProvider();
  const result = await provider.send({ to, body });
  return {
    ok: result.ok,
    sid: result.providerMessageId,
    error: result.error,
  };
}

