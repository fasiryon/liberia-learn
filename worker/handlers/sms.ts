import { sendSMS } from "@/lib/sms";

type SmsJobPayload = {
  to: string;
  body: string;
};

export async function handleSendSmsJob(payload: SmsJobPayload) {
  if (!payload?.to || !payload?.body) {
    throw new Error("to and body are required for SEND_SMS");
  }

  const result = await sendSMS(payload.to, payload.body);
  if (!result.ok) {
    throw new Error(result.error ?? "SMS send failed");
  }

  return result;
}
