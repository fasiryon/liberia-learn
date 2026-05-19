/**
 * Scenario 4: Guardian dashboard reads
 *
 * Simulates 500 concurrent guardians polling their child's progress.
 * Read-heavy; validates Redis caching and DB connection pool.
 *
 * Note: Uses a shared GUARDIAN_TOKEN env var (single guardian account).
 * If GUARDIAN_TOKEN is not set, VUs idle (no requests sent) to avoid
 * hammering the server with 500 unauthenticated connections.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const GUARDIAN_TOKEN = __ENV.GUARDIAN_TOKEN || "";

const guardianErrors = new Counter("guardian_dashboard_errors");

// 401/403/404 are acceptable when token is present but user has no children linked
const guardianCallback = http.expectedStatuses(200, 401, 403, 404);

const HEADERS = {
  "Content-Type": "application/json",
  Cookie: `__Secure-next-auth.session-token=${GUARDIAN_TOKEN}`,
};

export function guardian_reads() {
  // If no token configured, idle so 500 VUs don't hammer server with empty-token requests
  if (!GUARDIAN_TOKEN) {
    sleep(5);
    return;
  }

  // 1. Guardian dashboard
  const dashRes = http.get(`${BASE_URL}/api/guardian/dashboard`, { headers: HEADERS, responseCallback: guardianCallback });
  check(dashRes, {
    "guardian dashboard 200/401/403": (r) => [200, 401, 403].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });
  if (dashRes.status >= 500) guardianErrors.add(1);
  sleep(1);

  // 2. Guardian progress
  const progressRes = http.get(`${BASE_URL}/api/guardian/progress`, { headers: HEADERS, responseCallback: guardianCallback });
  check(progressRes, {
    "guardian progress 200/401/403/404": (r) => [200, 401, 403, 404].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });
  sleep(2);

  // 3. League table — guardians may not have a session; 401 is acceptable
  const leagueRes = http.get(`${BASE_URL}/api/league`, { headers: HEADERS, responseCallback: guardianCallback });
  check(leagueRes, { "league 200/401/403": (r) => [200, 401, 403].includes(r.status) });

  sleep(Math.random() * 3 + 2);
}
