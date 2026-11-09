/**
 * Preview-only safe error responses (T2 P2 finding on admin/school). On a deployed Preview/staging, a caught error
 * is reduced to a fixed authorization code or a generic infrastructure error, so a privileged freshness or database
 * failure raised inside authentication cannot reach the caller verbatim. Returns null outside Preview, leaving the
 * route's existing Production/local behavior untouched.
 */
import { NextResponse } from "next/server";
import { previewAutomationDisabled } from "@/lib/previewSideEffects";

const FIXED: Record<number, [string, string]> = {
  400: ["Bad request", "BAD_REQUEST"],
  401: ["Unauthorized", "UNAUTHORIZED"],
  403: ["Forbidden", "FORBIDDEN"],
  404: ["Not found", "NOT_FOUND"],
};

export function previewSafeErrorResponse(err: unknown): NextResponse | null {
  if (!previewAutomationDisabled()) return null;
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
  const [error, code] = FIXED[status] ?? ["Internal error", "INTERNAL_ERROR"];
  return NextResponse.json(
    { error, code },
    { status: FIXED[status] ? status : 500, headers: { "Cache-Control": "private, no-store" } }
  );
}
