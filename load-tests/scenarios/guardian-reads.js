/**
 * Scenario 4: Guardian dashboard reads
 *
 * Simulates guardians polling their child's progress.
 * Uses guardian-tokens.json when generated; otherwise idles (no unauthenticated load).
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

const tokens = new SharedArray("guardians", function () {
  try {
    return JSON.parse(open("../fixtures/guardian-tokens.json"));
  } catch {
    return [];
  }
});

const guardianErrors = new Counter("guardian_dashboard_errors");

const guardianCallback = http.expectedStatuses(200, 401, 403, 404);

export function guardian_reads() {
  if (tokens.length === 0) {
    sleep(5);
    return;
  }

  const { token } = tokens[__VU % tokens.length];
  const headers = {
    "Content-Type": "application/json",
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };

  const dashRes = http.get(`${BASE_URL}/api/guardian/dashboard`, {
    headers,
    responseCallback: guardianCallback,
  });
  check(dashRes, {
    "guardian dashboard 200/401/403": (r) => [200, 401, 403].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });
  if (dashRes.status >= 500) guardianErrors.add(1);
  sleep(1);

  const progressRes = http.get(`${BASE_URL}/api/guardian/progress`, {
    headers,
    responseCallback: guardianCallback,
  });
  check(progressRes, {
    "guardian progress 200/401/403/404": (r) => [200, 401, 403, 404].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });
  sleep(2);

  const leagueRes = http.get(`${BASE_URL}/api/league`, { headers, responseCallback: guardianCallback });
  check(leagueRes, { "league 200/401/403": (r) => [200, 401, 403].includes(r.status) });

  sleep(Math.random() * 3 + 2);
}
