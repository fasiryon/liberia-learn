import { getAuth0Issuer } from "@/lib/auth/privilegedIdentity";

type CachedManagementToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedManagementToken | null = null;

function managementConfig() {
  const issuer = getAuth0Issuer();
  const clientId = process.env.AUTH0_M2M_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) {
    throw new Error("Auth0 Management API is not configured");
  }
  return { issuer, clientId, clientSecret };
}

async function getManagementToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const { issuer, clientId, clientSecret } = managementConfig();
  const response = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `${issuer}/api/v2/`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Auth0 token request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Auth0 token response was incomplete");

  cachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 300) * 1000,
  };
  return body.access_token;
}

export async function resetAuth0Mfa(providerSubject: string): Promise<void> {
  const { issuer } = managementConfig();
  const token = await getManagementToken();
  const response = await fetch(
    `${issuer}/api/v2/users/${encodeURIComponent(providerSubject)}/authentication-methods`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Auth0 MFA reset failed with status ${response.status}`);
  }
}

export function resetAuth0ManagementCacheForTests(): void {
  cachedToken = null;
}
