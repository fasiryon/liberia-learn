import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || "dev-fallback-secret";
}

// No TTL — certificates never expire, so share tokens don't either.
export function generateShareToken(certificateId: string): string {
  return createHmac("sha256", getSecret())
    .update(`cert-share:${certificateId}`)
    .digest("base64url");
}

export function verifyShareToken(certificateId: string, token: string): boolean {
  try {
    const expected = generateShareToken(certificateId);
    const expectedBuf = Buffer.from(expected);
    const tokenBuf = Buffer.from(token);
    if (expectedBuf.length !== tokenBuf.length) return false;
    return timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}
