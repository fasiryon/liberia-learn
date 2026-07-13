/**
 * POST /api/dev/simulate-inbound-sms  (development only)
 *
 * Simulates an inbound SMS so the agent SMS path can be exercised without a
 * real Africa's Talking Liberia number. Blocked in production. Routes through
 * the same handleGuardianInbound() path the real webhook uses (Sprint 6.1),
 * so dev and prod behave identically. See docs/agents/SMS_VERIFICATION_CHECKLIST.md.
 *
 * Body: { from: string, text: string }
 */
import { NextRequest, NextResponse } from "next/server";
import "@/lib/agents/bootstrap";
import { handleGuardianInbound } from "@/lib/agents/sms/guardianInbound";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await handleGuardianInbound({
      from: typeof body?.from === "string" ? body.from : "",
      text: typeof body?.text === "string" ? body.text : "",
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    const message = err instanceof Error ? err.message : "request_failed";
    return NextResponse.json({ error: message }, { status });
  }
}
