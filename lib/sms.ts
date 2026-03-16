// lib/sms.ts - Backward-compatible wrapper for SMS sending.
import { TwilioSMSProvider } from "@/lib/sms/twilio-provider";

export async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const africaTalkingApiKey = process.env.AFRICA_TALKING_API_KEY?.trim();
  const africaTalkingUsername = process.env.AFRICA_TALKING_USERNAME?.trim();

  if (africaTalkingApiKey && africaTalkingUsername) {
    try {
      const AfricaTalking = require("africastalking");
      const client = AfricaTalking({
        apiKey: africaTalkingApiKey,
        username: africaTalkingUsername,
      });
      const response = await client.SMS.send({
        to: [to],
        message: body,
        ...(process.env.AFRICA_TALKING_SENDER_ID
          ? { from: process.env.AFRICA_TALKING_SENDER_ID }
          : {}),
      });
      const recipient = response?.SMSMessageData?.Recipients?.[0];

      return {
        ok: Number(recipient?.statusCode ?? 0) < 400,
        sid: recipient?.messageId,
        error: Number(recipient?.statusCode ?? 0) >= 400 ? recipient?.status : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const provider = new TwilioSMSProvider();
  const result = await provider.send({ to, body });
  return {
    ok: result.ok,
    sid: result.providerMessageId,
    error: result.error,
  };
}
