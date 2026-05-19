/**
 * Shared auth helpers for k6 load tests.
 */

import http from "k6/http";
import { check } from "k6";

export function splitEnv(...names) {
  for (const name of names) {
    const raw = __ENV[name];
    if (raw) {
      return raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function credentialFor(list, vu) {
  if (list.length === 0) return "";
  return list[(vu - 1) % list.length];
}

export function loginWithCredentials(baseUrl, email, password, callbackUrl, tags = {}) {
  if (!email || !password) return { ok: false, token: null };

  const csrf = http.get(`${baseUrl}/api/auth/csrf`, {
    tags: { ...tags, endpoint: "auth_csrf" },
  });
  const token = csrf.json("csrfToken");
  if (!token) return { ok: false, token: null };

  const res = http.post(
    `${baseUrl}/api/auth/callback/credentials?json=true`,
    {
      csrfToken: token,
      email,
      password,
      callbackUrl,
      json: "true",
    },
    {
      redirects: 0,
      tags: { ...tags, endpoint: "credentials_login" },
      responseCallback: http.expectedStatuses(200, 302, 401, 429),
    }
  );

  const ok = check(res, {
    "login accepted or rate limited": (r) => [200, 302, 429].includes(r.status),
  });

  const setCookie = res.headers["Set-Cookie"] || "";
  const match = setCookie.match(/__Secure-next-auth\.session-token=([^;]+)/);
  const sessionToken = match ? match[1] : ok && (res.status === 200 || res.status === 302) ? "established" : null;

  return { ok, token: sessionToken };
}

export function cookieHeader(sessionToken) {
  if (!sessionToken || sessionToken === "established") {
    return {};
  }
  return { Cookie: `__Secure-next-auth.session-token=${sessionToken}` };
}
