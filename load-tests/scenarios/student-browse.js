/**
 * Scenario 1: Student browsing lessons (read-heavy)
 *
 * Simulates students logging in, fetching today's dashboard, browsing the
 * lesson catalogue, and viewing the league table. Cache-hit rate for these
 * endpoints should be > 90% after cache-warm.
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

// Load token pool once, shared across all VUs
const tokens = new SharedArray("students", function () {
  return JSON.parse(open("../fixtures/student-tokens.json"));
});

const lessonViewErrors = new Counter("lesson_view_errors");
const lessonViewDuration = new Trend("lesson_view_duration", true);

export function student_browse() {
  const { email, token } = tokens[__VU % tokens.length];

  const headers = {
    "Content-Type": "application/json",
    Cookie: `next-auth.session-token=${token}`,
  };

  // 1. Student today dashboard
  const todayRes = http.get(`${BASE_URL}/api/student/today`, { headers });
  check(todayRes, { "today 200": (r) => r.status === 200 });
  sleep(0.5);

  // 2. Lesson catalogue page 1
  const lessonsRes = http.get(`${BASE_URL}/api/student/lessons?page=1`, { headers });
  check(lessonsRes, { "lessons 200": (r) => r.status === 200 });
  lessonViewDuration.add(lessonsRes.timings.duration);
  if (lessonsRes.status !== 200) lessonViewErrors.add(1);
  sleep(1);

  // 3. League table (should be Redis-cached)
  const leagueRes = http.get(`${BASE_URL}/api/league`, { headers });
  check(leagueRes, { "league 200": (r) => r.status === 200 });
  sleep(0.5);

  // 4. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { "health ok": (r) => r.status === 200 || r.status === 503 });

  sleep(Math.random() * 2 + 1);
}
