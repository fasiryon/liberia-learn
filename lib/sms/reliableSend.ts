import { sendSMS } from "@/lib/sms";

type ReliableSmsResult = {
  ok: boolean;
  sid?: string;
  error?: string;
  attempts: number;
};

type ReliableSmsOptions = {
  maxAttempts?: number;
  baseBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = Number(process.env.SMS_MAX_ATTEMPTS ?? 3);
const DEFAULT_BACKOFF_MS = Number(process.env.SMS_BASE_BACKOFF_MS ?? 250);

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error?: string) {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("timeout") ||
    normalized.includes("tempor") ||
    normalized.includes("network") ||
    normalized.includes("unavailable") ||
    normalized.includes("rate")
  );
}

export async function sendReliableSms(
  to: string,
  body: string,
  options?: ReliableSmsOptions
): Promise<ReliableSmsResult> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseBackoffMs = Math.max(50, options?.baseBackoffMs ?? DEFAULT_BACKOFF_MS);
  const sleep = options?.sleep ?? defaultSleep;

  let lastResult: ReliableSmsResult = {
    ok: false,
    error: "send_failed",
    attempts: 0,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await sendSMS(to, body);
    lastResult = {
      ok: result.ok,
      sid: result.sid,
      error: result.error,
      attempts: attempt,
    };

    if (result.ok || !isRetryableError(result.error) || attempt >= maxAttempts) {
      return lastResult;
    }

    await sleep(baseBackoffMs * Math.pow(2, attempt - 1));
  }

  return lastResult;
}
