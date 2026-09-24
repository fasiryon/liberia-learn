import { NextResponse } from "next/server";

/** Maps placement authority errors to JSON without leaking internals. */
export function placementErrorResponse(error: unknown) {
  const err = error as { status?: number; message?: string; code?: string };
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) {
    console.error("[placement] request failed", error);
    return NextResponse.json({ error: "Placement request failed", code: "placement_error" }, { status });
  }
  return NextResponse.json({ error: err?.message ?? "Request failed", code: err?.code ?? "placement_error" }, { status });
}
