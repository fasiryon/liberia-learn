/**
 * lib/logging/requestLogger.ts
 *
 * Lightweight structured logger for API requests.
 * - Output: JSON (machine-readable for log aggregators)
 * - Dev: console.log with [REQUEST] prefix
 * - Prod/other: single-line JSON to stdout via console.log
 * - Silent: when LOG_LEVEL=silent, logs nothing
 *
 * PII safety:
 * - userId is NEVER logged raw — always SHA-256 hashed (first 16 hex chars)
 * - Request body is never accepted as a parameter
 * - No passwords, tokens, emails, or student data
 */

import crypto from "crypto";

export interface RequestLogEntry {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  /** Will be hashed before output — never logged raw. */
  userId?: string;
  schoolId?: string;
  role?: string;
  timestamp: string;
}

interface StructuredLogEntry {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  userIdHash?: string;
  schoolId?: string;
  role?: string;
  timestamp: string;
}

/** Returns the first 16 hex characters of SHA-256(userId). */
export function hashUserId(userId: string): string {
  return crypto.createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

function isSilent(): boolean {
  return process.env.LOG_LEVEL === "silent";
}

/**
 * Log a structured request entry.
 * userId (if provided) is hashed before emission — the raw value is never written.
 */
export function logRequest(entry: RequestLogEntry): void {
  if (isSilent()) return;

  const { userId, ...rest } = entry;
  const structured: StructuredLogEntry = {
    ...rest,
    ...(userId !== undefined ? { userIdHash: hashUserId(userId) } : {}),
  };

  const json = JSON.stringify(structured);
  if (process.env.NODE_ENV === "development") {
    console.log("[REQUEST]", json);
  } else {
    console.log(json);
  }
}

/**
 * Wraps a Next.js route handler with request logging.
 * Measures wall-clock duration from call to response/throw.
 * Logs method, route, statusCode, and durationMs on every outcome.
 */
export function withRequestLogging(
  route: string,
  handler: (...args: any[]) => Promise<any>
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    const start = Date.now();
    const method: string = args[0]?.method ?? "UNKNOWN";

    try {
      const response = await handler(...args);
      logRequest({
        method,
        route,
        statusCode: response?.status ?? 200,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
      return response;
    } catch (err: any) {
      logRequest({
        method,
        route,
        statusCode: err?.status ?? 500,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  };
}
