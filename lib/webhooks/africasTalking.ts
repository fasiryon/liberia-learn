import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

export type AfricaTalkingWebhookBody = { raw: string; fields: Record<string, string> };
const replayedMessageIds = new Map<string, number>();
const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;
let redis: Redis | null | undefined;

function replayStore() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  redis = url && token ? new Redis({ url, token, cache: "no-store", retry: false } as any) : null;
  return redis;
}

export async function readAfricaTalkingBody(req: NextRequest): Promise<AfricaTalkingWebhookBody> {
  const raw = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { raw, fields: {} };
      return { raw, fields: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])) };
    } catch {
      return { raw, fields: {} };
    }
  }
  return { raw, fields: Object.fromEntries(new URLSearchParams(raw)) };
}

export function verifyAfricaTalkingSignature(raw: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const supplied = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(supplied, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authenticateAfricaTalkingWebhook(body: AfricaTalkingWebhookBody, req: NextRequest) {
  const secret = process.env.AT_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return { ok: false as const, status: 503, error: "webhook_auth_not_configured" };
  if (!verifyAfricaTalkingSignature(body.raw, req.headers.get("x-at-signature"), secret)) {
    return { ok: false as const, status: 401, error: "invalid_signature" };
  }
  return { ok: true as const };
}

export async function claimAfricaTalkingMessage(messageId: string): Promise<boolean> {
  const normalized = messageId.trim();
  if (!normalized) return false;
  const fingerprint = createHash("sha256").update(`africas-talking:${normalized}`).digest("hex");
  const store = replayStore();
  if (store) {
    const claimed = await store.set(`webhook-replay:${fingerprint}`, "1", { nx: true, ex: REPLAY_WINDOW_MS / 1000 });
    return claimed === "OK";
  }
  const now = Date.now();
  for (const [key, expiresAt] of replayedMessageIds) if (expiresAt <= now) replayedMessageIds.delete(key);
  if (replayedMessageIds.has(fingerprint)) return false;
  replayedMessageIds.set(fingerprint, now + REPLAY_WINDOW_MS);
  if (replayedMessageIds.size > 10_000) replayedMessageIds.delete(replayedMessageIds.keys().next().value as string);
  return true;
}
