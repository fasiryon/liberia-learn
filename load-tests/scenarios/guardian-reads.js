/**
 * Scenario 4: Guardian dashboard reads
 *
 * Simulates 500 concurrent guardians polling their child's progress.
 * Read-heavy; validates Redis caching and DB connection pool.
 *
 * Note: Uses a shared GUARDIAN_TOKEN env var (single guardian account)
 * since guardian test accounts are not part of the 1,000-student seed pool.
 * For full multi-account guardian load testing, extend seed-load-test-users.ts
 * to create guardian accounts and generate tokens via generate-load-test-tokens.ts.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const GUARDIAN_TOKEN = __ENV.GUARDIAN_TOKEN || "";

const guardianErrors = new Counter("guardian_dashboard_errors");

const HEADERS = {
  "Content-Type": "application/json",
  Cookie: `next-auth.session-token=${GUARDIAN_TOKEN}`,
};

export function guardian_reads() {
  // 1. Guardian dashboard
  const dashRes = http.get(`${BASE_URL}/api/guardian/dashboard`, { headers: HEADERS });
  check(dashRes, {
    "guardian dashboard 200": (r) => r.status === 200,
    "no 5xx": (r) => r.status < 500,
  });
  if (dashRes.status >= 500) guardianErrors.add(1);
  sleep(1);

  // 2. Guardian progress
  const progressRes = http.get(`${BASE_URL}/api/guardian/progress`, { headers: HEADERS });
  check(progressRes, {
    "guardian progress 200/404": (r) => [200, 404].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });
  sleep(2);

  // 3. League table (public, should be heavily cached)
  const leagueRes = http.get(`${BASE_URL}/api/league`);
  check(leagueRes, { "league 200": (r) => r.status === 200 });

  sleep(Math.random() * 3 + 2);
}
