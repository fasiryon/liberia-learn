import { isP2bReviewOperationsEnabled } from "@/lib/serverFlags";
import { ReviewOperationError } from "./errors";

export function requireP2bEnabled(): void {
  if (!isP2bReviewOperationsEnabled()) throw new ReviewOperationError("P2B_DISABLED", 404);
}

export function requireIdempotencyKey(req: Request, body?: { idempotencyKey?: unknown }): string {
  const value = req.headers.get("idempotency-key") ?? body?.idempotencyKey;
  if (typeof value !== "string" || !value.trim() || value.length > 300) {
    throw new ReviewOperationError("IDEMPOTENCY_KEY_REQUIRED", 400);
  }
  return value.trim();
}

export function reviewApiError(error: unknown): Response {
  if (error instanceof ReviewOperationError) {
    return Response.json({ error: error.code, message: error.message, details: error.details }, { status: error.status });
  }
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
  return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status });
}
