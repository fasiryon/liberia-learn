import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const CANVA_OAUTH_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_OAUTH_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_OAUTH_SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "profile:read",
];
export const CANVA_OAUTH_COOKIE_NAMES = {
  verifier: "canva_oauth_code_verifier",
  state: "canva_oauth_state",
} as const;
const CANVA_OAUTH_PROVIDER = "canva";
const CANVA_TOKEN_ENVELOPE_VERSION = 1;
export const CANVA_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type CanvaOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  token_type?: string | null;
  scope?: string | null;
};

type StoredCanvaOAuthTokenBundle = CanvaOAuthTokenResponse & {
  received_at: string;
  expires_at?: string | null;
};

export type CanvaOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function hasCanvaOAuthClientConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.CANVA_CLIENT_ID?.trim() &&
      env.CANVA_CLIENT_SECRET?.trim() &&
      env.CANVA_REDIRECT_URI?.trim()
  );
}

export function getCanvaOAuthConfig(env: NodeJS.ProcessEnv = process.env): CanvaOAuthConfig {
  const clientId = env.CANVA_CLIENT_ID?.trim();
  const clientSecret = env.CANVA_CLIENT_SECRET?.trim();
  const redirectUri = env.CANVA_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error("Canva OAuth environment is not configured"), {
      status: 503,
      code: "CANVA_OAUTH_ENV_MISSING",
    });
  }

  return { clientId, clientSecret, redirectUri };
}

export function createCanvaPkcePair() {
  const codeVerifier = randomBytes(96).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(32).toString("base64url");

  return { codeVerifier, codeChallenge, state };
}

export function buildCanvaAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scopes?: string[];
}) {
  const url = new URL(CANVA_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", (input.scopes ?? CANVA_OAUTH_SCOPES).join(" "));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("state", input.state);
  return url;
}

export async function saveCanvaOAuthState(input: {
  state: string;
  codeVerifier: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + CANVA_OAUTH_STATE_TTL_MS);

  await prisma.canvaOAuthState.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  await prisma.canvaOAuthState.create({
    data: {
      state: input.state,
      codeVerifier: input.codeVerifier,
      expiresAt,
    },
  });

  return { expiresAt };
}

export async function consumeCanvaOAuthState(input: { state: string; now?: Date }) {
  const now = input.now ?? new Date();
  const record = await prisma.canvaOAuthState.findUnique({
    where: {
      state: input.state,
    },
  });

  if (!record) {
    throw Object.assign(new Error("Canva OAuth state was not found or has already been used"), {
      status: 400,
      code: "CANVA_OAUTH_STATE_MISSING",
    });
  }

  await prisma.canvaOAuthState.delete({
    where: {
      state: input.state,
    },
  });

  if (record.expiresAt.getTime() <= now.getTime()) {
    throw Object.assign(new Error("Canva OAuth state has expired. Please reconnect Canva."), {
      status: 400,
      code: "CANVA_OAUTH_STATE_EXPIRED",
    });
  }

  return record.codeVerifier;
}

function getCanvaTokenEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw Object.assign(new Error("Canva token encryption secret is missing"), {
      status: 503,
      code: "CANVA_TOKEN_SECRET_MISSING",
    });
  }

  return createHash("sha256").update(secret).digest();
}

function encryptTokenBundle(bundle: StoredCanvaOAuthTokenBundle): string {
  const key = getCanvaTokenEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(bundle), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([
    Buffer.from([CANVA_TOKEN_ENVELOPE_VERSION]),
    iv,
    authTag,
    ciphertext,
  ]).toString("base64url");
}

function decryptTokenBundle(encryptedTokenSet: string): StoredCanvaOAuthTokenBundle {
  const key = getCanvaTokenEncryptionKey();
  const raw = Buffer.from(encryptedTokenSet, "base64url");

  if (raw.length < 29) {
    throw new Error("Encrypted Canva token payload is too short");
  }

  const version = raw.readUInt8(0);
  if (version !== CANVA_TOKEN_ENVELOPE_VERSION) {
    throw new Error(`Unsupported Canva token envelope version: ${version}`);
  }

  const iv = raw.subarray(1, 13);
  const authTag = raw.subarray(13, 29);
  const ciphertext = raw.subarray(29);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as StoredCanvaOAuthTokenBundle;
}

async function fetchCanvaToken(input: {
  grantType: "authorization_code" | "refresh_token";
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code?: string;
  codeVerifier?: string;
  refreshToken?: string;
}) {
  const body = new URLSearchParams();
  body.set("grant_type", input.grantType);
  body.set("redirect_uri", input.redirectUri);

  if (input.grantType === "authorization_code") {
    if (!input.code || !input.codeVerifier) {
      throw new Error("Authorization code exchange requires code and code verifier");
    }
    body.set("code", input.code);
    body.set("code_verifier", input.codeVerifier);
  } else if (input.refreshToken) {
    body.set("refresh_token", input.refreshToken);
  }

  const response = await fetch(CANVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw Object.assign(
      new Error(`Canva token exchange failed with status ${response.status}`),
      {
        status: 502,
        details: errorBody,
      }
    );
  }

  return (await response.json()) as CanvaOAuthTokenResponse;
}

function toStoredBundle(tokenResponse: CanvaOAuthTokenResponse) {
  const receivedAt = new Date().toISOString();
  const expiresAt =
    typeof tokenResponse.expires_in === "number" && Number.isFinite(tokenResponse.expires_in)
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : null;

  return {
    receivedAt,
    expiresAt,
    bundle: {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token ?? null,
      expires_in: tokenResponse.expires_in ?? null,
      token_type: tokenResponse.token_type ?? null,
      scope: tokenResponse.scope ?? null,
      received_at: receivedAt,
      expires_at: expiresAt,
    } satisfies StoredCanvaOAuthTokenBundle,
  };
}

export async function persistCanvaOAuthTokens(tokenResponse: CanvaOAuthTokenResponse) {
  const { bundle, expiresAt } = toStoredBundle(tokenResponse);
  await prisma.canvaOAuthCredential.upsert({
    where: { provider: CANVA_OAUTH_PROVIDER },
    create: {
      provider: CANVA_OAUTH_PROVIDER,
      encryptedTokenSet: encryptTokenBundle(bundle),
      accessTokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
      scope: bundle.scope ?? null,
      tokenType: bundle.token_type ?? null,
    },
    update: {
      encryptedTokenSet: encryptTokenBundle(bundle),
      accessTokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
      scope: bundle.scope ?? null,
      tokenType: bundle.token_type ?? null,
    },
  });
}

export async function loadCanvaOAuthTokens() {
  const credential = await prisma.canvaOAuthCredential.findUnique({
    where: { provider: CANVA_OAUTH_PROVIDER },
  });

  if (!credential) {
    return null;
  }

  return decryptTokenBundle(credential.encryptedTokenSet);
}

export async function resolveCanvaMcpAuthorizationToken() {
  if (process.env.CANVA_MCP_AUTHORIZATION_TOKEN?.trim()) {
    return process.env.CANVA_MCP_AUTHORIZATION_TOKEN.trim();
  }

  const credential = await prisma.canvaOAuthCredential.findUnique({
    where: { provider: CANVA_OAUTH_PROVIDER },
  });

  if (!credential) {
    throw Object.assign(new Error("Canva OAuth token is not configured"), {
      status: 503,
      code: "CANVA_OAUTH_TOKEN_MISSING",
    });
  }

  const bundle = decryptTokenBundle(credential.encryptedTokenSet);
  const now = Date.now();
  const accessExpiresAt = credential.accessTokenExpiresAt?.getTime() ?? null;
  if (bundle.access_token && (accessExpiresAt == null || accessExpiresAt - now > 60_000)) {
    return bundle.access_token;
  }

  if (!bundle.refresh_token) {
    throw Object.assign(new Error("Canva access token expired and no refresh token is stored"), {
      status: 503,
      code: "CANVA_OAUTH_REFRESH_MISSING",
    });
  }

  const { clientId, clientSecret, redirectUri } = getCanvaOAuthConfig();
  const refreshed = await fetchCanvaToken({
    grantType: "refresh_token",
    clientId,
    clientSecret,
    redirectUri,
    refreshToken: bundle.refresh_token,
  });
  await persistCanvaOAuthTokens(refreshed);
  return refreshed.access_token;
}

export async function exchangeCanvaAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
}) {
  const { clientId, clientSecret, redirectUri } = getCanvaOAuthConfig();
  const tokenResponse = await fetchCanvaToken({
    grantType: "authorization_code",
    clientId,
    clientSecret,
    redirectUri,
    code: input.code,
    codeVerifier: input.codeVerifier,
  });

  await persistCanvaOAuthTokens(tokenResponse);
  return tokenResponse;
}
