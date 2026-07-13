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
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import "@/lib/agents/bootstrap";
import { handleGuardianInbound } from "@/lib/agents/sms/guardianInbound";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function readBody(req: NextRequest): Promise<{ raw: string; fields: Record<string, string> }> {
  const raw = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw || "{}");
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) fields[k] = String(v);
      return { raw, fields };
    } catch {
      return { raw, fields: {} };
    }
  }

  const fields: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) fields[k] = v;
  return { raw, fields };
}

function verifySignature(raw: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const { raw, fields } = await readBody(req);

    const secret = process.env.AT_WEBHOOK_SECRET?.trim();
    if (secret) {
      const signature = req.headers.get("x-at-signature");
      if (!verifySignature(raw, signature, secret)) {
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
      }
    }

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
