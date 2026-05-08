import { logger } from "@/lib/logger";

export type WriteThrottleOptions = {
  maxConcurrency?: number;
  delayMs?: number;
  maxRetries?: number;
};

let activeWrites = 0;
const waiters: Array<() => void> = [];

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function defaults(): Required<WriteThrottleOptions> {
  return {
    maxConcurrency: readPositiveInt(process.env.CURRICULUM_REGEN_DB_WRITE_CONCURRENCY, 1),
    delayMs: readPositiveInt(process.env.CURRICULUM_REGEN_DB_WRITE_DELAY_MS, 250),
    maxRetries: readPositiveInt(process.env.CURRICULUM_REGEN_DB_WRITE_MAX_RETRIES, 3),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConnectionReset(error: unknown) {
  const err = error as { code?: string; message?: string };
  const message = String(err?.message ?? "").toLowerCase();
  return (
    err?.code === "ECONNRESET" ||
    err?.code === "P1001" ||
    err?.code === "P1002" ||
    err?.code === "P2024" ||
    message.includes("econnreset") ||
    message.includes("connection reset") ||
    message.includes("connection terminated") ||
    message.includes("pool timeout") ||
    message.includes("can't reach database")
  );
}

async function acquire(maxConcurrency: number) {
  while (activeWrites >= maxConcurrency) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  activeWrites += 1;
}

function release() {
  activeWrites = Math.max(0, activeWrites - 1);
  const waiter = waiters.shift();
  if (waiter) waiter();
}

export async function withDbWriteThrottle<T>(
  operationName: string,
  write: () => Promise<T>,
  options: WriteThrottleOptions = {}
): Promise<T> {
  const merged = { ...defaults(), ...options };

  for (let attempt = 1; attempt <= merged.maxRetries; attempt += 1) {
    await acquire(merged.maxConcurrency);
    try {
      const result = await write();
      if (merged.delayMs > 0) await sleep(merged.delayMs);
      return result;
    } catch (error) {
      const retry = isConnectionReset(error) && attempt < merged.maxRetries;
      logger.warn("[DB_WRITE_THROTTLE] write failed", {
        operationName,
        attempt,
        maxRetries: merged.maxRetries,
        retry,
        message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      });
      if (!retry) throw error;
      await sleep(merged.delayMs * 2 ** attempt);
    } finally {
      release();
    }
  }

  return write();
}

export const __writeThrottleTest = {
  isConnectionReset,
};
