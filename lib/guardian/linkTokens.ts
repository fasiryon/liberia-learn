import crypto from "crypto";

export type GuardianLinkPayload = {
  v: 1;
  studentId: string;
  schoolId: string;
  relation?: string | null;
  exp: number;
};

function getSecret(): string | null {
  return process.env.GUARDIAN_LINK_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
}

function requireSecret(): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("Guardian link token secret is not configured");
  }
  return secret;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unbase64url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

function sign(data: string, secret: string): string {
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  return base64url(sig);
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createGuardianLinkToken(payload: GuardianLinkPayload): string {
  const secret = requireSecret();
  const data = base64url(JSON.stringify(payload));
  const sig = sign(data, secret);
  return `${data}.${sig}`;
}

export function parseGuardianLinkToken(token: string): GuardianLinkPayload | null {
  const secret = getSecret();
  if (!secret) return null;

  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = sign(data, secret);
  if (!safeEqual(sig, expected)) return null;

  try {
    const raw = JSON.parse(unbase64url(data)) as GuardianLinkPayload;
    if (!raw || raw.v !== 1) return null;
    if (!raw.studentId || !raw.schoolId || !raw.exp) return null;
    if (Date.now() > raw.exp) return null;
    return raw;
  } catch {
    return null;
  }
}
