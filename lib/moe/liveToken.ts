import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getSecret(): string {
  return (
    process.env.LIVE_DASHBOARD_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-fallback-secret"
  );
}

export function generateLiveToken(): { token: string; expiresAt: string } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `moe-live:${expiresAt}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const token = Buffer.from(`${expiresAt}.${signature}`).toString("base64url");
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyLiveToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const dotIdx = decoded.indexOf(".");
    if (dotIdx === -1) return false;
    const expiryStr = decoded.slice(0, dotIdx);
    const sig = decoded.slice(dotIdx + 1);
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;
    const payload = `moe-live:${expiry}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
