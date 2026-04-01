/**
 * lib/errors/apiErrorHandler.ts
 *
 * Standardized error handler for Next.js API routes.
 *
 * Maps known error types to appropriate HTTP status codes and returns a
 * consistent, PII-safe error shape: { error, code, timestamp }.
 *
 * Stack traces are NEVER included in the HTTP response.
 * Errors are logged server-side via console.error.
 *
 * Supported mappings:
 *   Prisma P2002 → 409 CONFLICT
 *   Prisma P2025 → 404 NOT_FOUND
 *   Prisma P2003 → 400 BAD_REQUEST
 *   ZodError     → 422 VALIDATION_ERROR
 *   { status:401 } → 401 UNAUTHORIZED
 *   { status:403 } → 403 FORBIDDEN
 *   unknown      → 500 INTERNAL_ERROR
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export interface ApiErrorResponse {
  error: string;
  code: string;
  timestamp: string;
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
    typeof (err as any).code === "string" &&
    (err as any).code.startsWith("P")
  );
}

function isZodError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as any).name === "ZodError"
  );
}

/**
 * Call inside route catch blocks in place of ad-hoc NextResponse.json error returns.
 * Never throws — always returns a NextResponse.
 */
export function handleApiError(err: unknown): NextResponse<ApiErrorResponse> {
  const timestamp = new Date().toISOString();

  // Log server-side — stack trace stays on the server, never in the response
  if (process.env.NODE_ENV !== "test") {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as any).message)
        : String(err);
    logger.error("API handler error", {
      errorMessage: msg,
      status: typeof err === "object" && err !== null && "status" in err ? (err as any).status : 500,
    });
  }

  // Auth errors thrown by requireUser / requireRole (carry a status property)
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as any).status as number;
    const message = String((err as any).message ?? "Authentication error");
    if (status === 401) {
      return NextResponse.json(
        { error: message, code: "UNAUTHORIZED", timestamp },
        { status: 401 }
      );
    }
    if (status === 403) {
      return NextResponse.json(
        { error: message, code: "FORBIDDEN", timestamp },
        { status: 403 }
      );
    }
  }

  // Prisma known request errors
  if (isPrismaKnownError(err)) {
    const mapping = PRISMA_ERROR_MAP[err.code];
    if (mapping) {
      return NextResponse.json(
        { error: mapping.message, code: mapping.code, timestamp },
        { status: mapping.status }
      );
    }
  }

  // Zod validation errors
  if (isZodError(err)) {
    return NextResponse.json(
      { error: "Validation failed", code: "VALIDATION_ERROR", timestamp },
      { status: 422 }
    );
  }

  // Unknown — return opaque 500; never leak details or stack traces
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR", timestamp },
    { status: 500 }
  );
}
