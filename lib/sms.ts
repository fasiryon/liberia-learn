// lib/sms.ts — SMS via Twilio (optional, degrades gracefully)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

export async function sendSMS(
  to: string,
  body: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) {
    console.log(`[SMS-DEV] To: ${to} | Body: ${body}`);
    return { ok: true, sid: "dev-no-send" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64");

    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", TWILIO_FROM);
    params.set("Body", body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, sid: data.sid };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}
