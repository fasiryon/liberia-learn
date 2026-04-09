import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export interface ApiErrorResponse {
  error: string;
  code: string;
  timestamp: string;
  requestId: string;
}

export interface ApiErrorContext {
  requestId?: string;
  route?: string;
  method?: string;
}

const PRISMA_ERROR_MAP: Record<string, { status: number; message: string; code: string }> = {
  P2002: { status: 409, message: "Resource already exists", code: "CONFLICT" },
  P2025: { status: 404, message: "Record not found", code: "NOT_FOUND" },
  P2003: { status: 400, message: "Invalid reference", code: "BAD_REQUEST" },
};

function isPrismaKnownError(err: unknown): err is { code: string; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("P")
  );
}

function isZodError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "ZodError";
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: unknown }).message);
  }

  return String(err);
}

function getErrorStatus(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    return Number((err as { status?: unknown }).status ?? 500);
  }

  return 500;
}

function json(body: ApiErrorResponse, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": body.requestId,
    },
  });
}

export function handleApiError(err: unknown, context: ApiErrorContext = {}): NextResponse<ApiErrorResponse> {
  const timestamp = new Date().toISOString();
  const requestId = context.requestId ?? crypto.randomUUID();
  const message = getErrorMessage(err);
  const baseLogMetadata = {
    route: context.route,
    method: context.method,
    errorMessage: message,
    errorName: err instanceof Error ? err.name : typeof err,
  };

  if (typeof err === "object" && err !== null && "status" in err) {
    const status = getErrorStatus(err);
    const authMessage = String((err as { message?: unknown }).message ?? "Authentication error");
    if (process.env.NODE_ENV !== "test") {
      logger.warn("API handler error", { ...baseLogMetadata, status }, undefined, requestId);
    }

    if (status === 401) {
      return json({ error: authMessage, code: "UNAUTHORIZED", timestamp, requestId }, 401);
    }

    if (status === 403) {
      return json({ error: authMessage, code: "FORBIDDEN", timestamp, requestId }, 403);
    }

    if (status >= 400 && status < 500) {
      const code =
        status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : "BAD_REQUEST";
      return json({ error: authMessage, code, timestamp, requestId }, status);
    }
  }

  if (isPrismaKnownError(err)) {
    const mapping = PRISMA_ERROR_MAP[err.code];
    if (mapping) {
      if (process.env.NODE_ENV !== "test") {
        logger.warn("API handler error", { ...baseLogMetadata, status: mapping.status, code: mapping.code }, undefined, requestId);
      }
      return json({ error: mapping.message, code: mapping.code, timestamp, requestId }, mapping.status);
    }
  }

  if (isZodError(err)) {
    if (process.env.NODE_ENV !== "test") {
      logger.warn("API handler error", { ...baseLogMetadata, status: 422, code: "VALIDATION_ERROR" }, undefined, requestId);
    }
    return json({ error: "Validation failed", code: "VALIDATION_ERROR", timestamp, requestId }, 422);
  }

  if (process.env.NODE_ENV !== "test") {
    logger.error("API handler error", { ...baseLogMetadata, status: 500, code: "INTERNAL_ERROR" }, undefined, requestId);
  }

  Sentry.captureException(err instanceof Error ? err : new Error(message), {
    tags: {
      component: "api",
      route: context.route ?? "unknown",
      method: context.method ?? "UNKNOWN",
    },
    extra: {
      requestId,
      status: 500,
    },
  });

  return json({ error: "Internal server error", code: "INTERNAL_ERROR", timestamp, requestId }, 500);
}
