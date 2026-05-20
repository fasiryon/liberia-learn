/**
 * Pre-warm Redis caches and Vercel function instances for all load-test student tokens.
 * Run this BEFORE the main k6-config.js to ensure:
 *   1. Per-student Redis caches (today + lessons) are populated, preventing DB overload.
 *   2. Vercel function instances for the quiz-submit route are warm, preventing the
 *      cold-start storm that causes 15-20s response times when submission_spike fires.
 *
 * Usage:
 *   k6 run load-tests/cache-warm.js
 *
 * Takes ~90-120s for 1,000 students at 50 VUs.
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

// A non-existent UUID — causes a fast PK null-lookup → 404, but still warms the
// Vercel function instance and the Prisma connection pool for the quiz-submit route.
const WARM_SUBMISSION_ID = "00000000-0000-0000-0000-000000000001";

const tokens = new SharedArray("students", function () {
  return JSON.parse(open("./fixtures/student-tokens.json"));
});

export const options = {
  scenarios: {
    warm_today: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: Math.ceil(tokens.length / 50),
      maxDuration: "5m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const idx = (__VU - 1) * Math.ceil(tokens.length / 50) + (__ITER % Math.ceil(tokens.length / 50));
  if (idx >= tokens.length) return;

  const { token } = tokens[idx];
  const headers = { Cookie: `__Secure-next-auth.session-token=${token}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  // Warm today (per-student cache)
  const todayRes = http.get(`${BASE_URL}/api/student/today`, { headers });
  check(todayRes, { "today warmed": (r) => r.status === 200 });

  // Warm lessons (shared content cache — only one request needed, but harmless to repeat)
  const lessonsRes = http.get(`${BASE_URL}/api/student/lessons?page=1`, { headers });
  check(lessonsRes, { "lessons warmed": (r) => r.status === 200 });

  // Warm quiz-submit Vercel function instances. The UUID doesn't exist so the route
  // returns 404 immediately after two fast PK lookups. The Vercel instance is now warm
  // and ready for submission_spike — prevents the 15-20s cold-start storm.
  const subRes = http.post(
    `${BASE_URL}/api/student/lessons/${WARM_SUBMISSION_ID}/quiz/submit`,
    JSON.stringify({ answers: [], scheduledWorkId: WARM_SUBMISSION_ID }),
    { headers: jsonHeaders, responseCallback: http.expectedStatuses(200, 201, 400, 404) }
  );
  check(subRes, { "submit warmed": (r) => r.status === 404 || r.status === 400 });
}
