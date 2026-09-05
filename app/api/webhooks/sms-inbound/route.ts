/**
 * POST /api/webhooks/sms-inbound
 *
 * Production inbound SMS webhook, Africa's Talking format. Extracts
 * { from, text, receivedAt, messageId }, validates an HMAC signature if
 * AT_WEBHOOK_SECRET is configured (defensive — Africa's Talking Liberia
 * number is not provisioned yet, so this is unverified against a real
 * payload), then routes to the liberialearn-family agent via the same
 * normalization path as the dev simulator.
 */
import { NextRequest, NextResponse } from "next/server";
import "@/lib/agents/bootstrap";
import { handleGuardianInbound } from "@/lib/agents/sms/guardianInbound";
import { logger } from "@/lib/logger";
import { authenticateAfricaTalkingWebhook, readAfricaTalkingBody } from "@/lib/webhooks/africasTalking";

// route-policy: auth=provider; scope=none; authority=africas-talking-hmac; rationale=guardian inbound webhook

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await readAfricaTalkingBody(req);
    const auth = authenticateAfricaTalkingWebhook(body, req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { fields } = body;

    const from = fields.from ?? "";
    const text = fields.text ?? "";
    const messageId = fields.id ?? null;

    const result = await handleGuardianInbound({ from, text });

    return NextResponse.json({ ok: true, messageId, ...result });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    const message = err instanceof Error ? err.message : "request_failed";
    logger.error("[webhooks.sms-inbound] failed", { message, status });
    return NextResponse.json({ error: message }, { status });
  }
}
