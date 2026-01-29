// lib/logger.ts
type LogLevel = "info" | "warn" | "error";

interface LogData {
  level: LogLevel;
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

class Logger {
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    userId?: string
  ) {
    const logData: LogData = {
      level,
      message,
      userId,
      metadata,
      timestamp: new Date(),
    };

    if (process.env.NODE_ENV === "development") {
      console.log(`[${level.toUpperCase()}]`, message, metadata);
    }

    if (process.env.NODE_ENV === "production") {
      this.sendToDatabase(logData);
    }
  }

  private async sendToDatabase(logData: LogData) {
    // Later: store in DB or external logging service
    console.log("Would log to DB:", logData);
  }

  info(message: string, metadata?: Record<string, any>, userId?: string) {
    this.log("info", message, metadata, userId);
  }

  warn(message: string, metadata?: Record<string, any>, userId?: string) {
    this.log("warn", message, metadata, userId);
  }

  error(message: string, metadata?: Record<string, any>, userId?: string) {
    this.log("error", message, metadata, userId);
  }
}

export const logger = new Logger();
