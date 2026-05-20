/**
 * Pre-warm Redis caches for all load-test student tokens.
 * Run this BEFORE the main k6-config.js to ensure all per-student
 * caches (today + lessons) are populated in Redis, preventing DB
 * overload during the peak-ramp phase of the load test.
 *
 * Note: quiz-submit Vercel instances are NOT pre-warmed here. The
 * submission_spike scenario uses ramping-arrival-rate (5 req/s for 2min)
 * which self-warms Prisma connection pools before hitting peak rate.
 *
 * Usage:
 *   k6 run load-tests/cache-warm.js
 *
 * Takes ~30-60s for 1,000 students at 50 VUs.
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

const tokens = new SharedArray("students", function () {
  return JSON.parse(open("./fixtures/student-tokens.json"));
});

export const options = {
  scenarios: {
    warm_today: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: Math.ceil(tokens.length / 50),
      maxDuration: "3m",
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

  // Warm today (per-student cache)
  const todayRes = http.get(`${BASE_URL}/api/student/today`, { headers });
  check(todayRes, { "today warmed": (r) => r.status === 200 });

  // Warm lessons (shared content cache — only one request needed, but harmless to repeat)
  const lessonsRes = http.get(`${BASE_URL}/api/student/lessons?page=1`, { headers });
  check(lessonsRes, { "lessons warmed": (r) => r.status === 200 });
}
