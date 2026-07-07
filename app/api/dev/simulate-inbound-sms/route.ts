/**
 * POST /api/dev/simulate-inbound-sms  (development only)
 *
 * Simulates an inbound SMS so the agent SMS path can be exercised without a
 * real Africa's Talking Liberia number. Blocked in production. No SMS-facing
 * agent is wired yet (6.1+), so the response reports the normalized inbound and
 * handled=false. See docs/agents/SMS_VERIFICATION_CHECKLIST.md.
 *
 * Body: { from: string, text: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { parseInboundSms } from "@/lib/agents/sms/inbound";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const received = parseInboundSms({
      from: typeof body?.from === "string" ? body.from : "",
      text: typeof body?.text === "string" ? body.text : "",
    });

    return NextResponse.json({
      received,
      handled: false,
      reason: "no_sms_agent_registered",
      note: "Inbound parsed successfully. An SMS-facing agent will handle replies in a later sprint (6.1+).",
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    const message = err instanceof Error ? err.message : "request_failed";
    return NextResponse.json({ error: message }, { status });
  }
}
