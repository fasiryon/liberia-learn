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
  metadata?: Record<string, JsonLike>;
  timestamp: string;
  service: "liberialearn";
}

function sanitizeValue(value: unknown): JsonLike {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "development" ? value.stack ?? null : null,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        sanitizeValue(entryValue),
      ])
    );
  }
  if (value === undefined) {
    return null;
  }
  return value as JsonLike;
}

class Logger {
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, userId?: string) {
    const logData: LogData = {
      level,
      message,
      userId,
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

  info(message: string, metadata?: Record<string, unknown>, userId?: string) {
    this.log("info", message, metadata, userId);
  }

  warn(message: string, metadata?: Record<string, unknown>, userId?: string) {
    this.log("warn", message, metadata, userId);
  }

  error(message: string, metadata?: Record<string, unknown>, userId?: string) {
    this.log("error", message, metadata, userId);
  }
}

export const logger = new Logger();
