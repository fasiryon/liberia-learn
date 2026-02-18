// lib/sms.ts — SMS via Africa's Talking (primary) or Twilio (fallback)

export async function sendSMS(
  to: string,
  body: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  // Guard: skip in dev unless sandbox
  if (process.env.NODE_ENV !== "production" && process.env.AT_ENVIRONMENT !== "sandbox") {
    console.log(`[SMS-DEV] To: ${to} | Body: ${body}`);
    return { ok: true, sid: "dev-no-send" };
  }

  // Try Africa's Talking first
  const atKey = process.env.AT_API_KEY;
  const atUser = process.env.AT_USERNAME;
  if (atKey && atUser) {
    try {
      const AfricasTalking = require("africastalking");
      const client = AfricasTalking({ apiKey: atKey, username: atUser });
      const result = await client.SMS.send({
        to: [to],
        message: body,
        from: process.env.AT_SENDER_ID || undefined,
      });
      console.log(`[SMS-AT] Sent to ${to}:`, JSON.stringify(result));
      return { ok: true, sid: "at-sent" };
    } catch (err: any) {
      console.error(`[SMS-AT] Failed:`, err.message);
      return { ok: false, error: err.message };
    }
  }

  // Fallback: Twilio
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
  if (TWILIO_SID && TWILIO_AUTH && TWILIO_FROM) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
      const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64");
      const params = new URLSearchParams();
      params.set("To", to);
      params.set("From", TWILIO_FROM);
      params.set("Body", body);
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message ?? `HTTP ${res.status}` };
      return { ok: true, sid: data.sid };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  }

  console.log(`[SMS] No SMS provider configured, skipping`);
  return { ok: true, sid: "no-provider" };
}
