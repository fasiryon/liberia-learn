type LogLevel = "info" | "warn" | "error";

type JsonLike =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonLike[]
  | { [key: string]: JsonLike };

interface LogData {
  level: LogLevel;
  message: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, JsonLike>;
  timestamp: string;
  service: "liberialearn";
}

const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "email",
  "html",
  "password",
  "phone",
  "resettoken",
  "secret",
  "token",
]);

function sanitizeString(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/\b\d{7,15}\b/g, "[REDACTED_NUMBER]");
}

function sanitizeValue(value: unknown): JsonLike {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: process.env.NODE_ENV === "development" ? value.stack ?? null : null,
    };
  }
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeValue(entryValue),
      ])
    );
  }
  if (value === undefined) {
    return null;
  }
  return value as JsonLike;
}

class Logger {
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    userId?: string,
    requestId?: string
  ) {
    const logData: LogData = {
      level,
      message: sanitizeString(message),
      userId,
      requestId,
      metadata: metadata ? (sanitizeValue(metadata) as Record<string, JsonLike>) : undefined,
      timestamp: new Date().toISOString(),
      service: "liberialearn",
    };

    const serialized = JSON.stringify(logData);
    if (level === "error") {
      console.error(serialized);
      return;
    }
    if (level === "warn") {
      console.warn(serialized);
      return;
    }
    console.log(serialized);
  }

  info(message: string, metadata?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("info", message, metadata, userId, requestId);
  }

  warn(message: string, metadata?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("warn", message, metadata, userId, requestId);
  }

  error(message: string, metadata?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("error", message, metadata, userId, requestId);
  }
}

export const logger = new Logger();
