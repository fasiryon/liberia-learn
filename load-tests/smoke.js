/**
 * Smoke test: 5 VUs × 30s — verifies token auth and core endpoints return 200.
 * Run: k6 run --vus 5 --duration 30s load-tests/smoke.js
 */
import { SharedArray } from "k6/data";
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

const tokens = new SharedArray("students", function () {
  return JSON.parse(open("./fixtures/student-tokens.json"));
});

export default function () {
  const { token } = tokens[__VU % tokens.length];
  const headers = {
    "Content-Type": "application/json",
    // NextAuth v4 uses __Secure- prefix on HTTPS production
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };

  const todayRes = http.get(`${BASE_URL}/api/student/today`, { headers });
  check(todayRes, { "today 200": (r) => r.status === 200 });
  sleep(0.5);

  const lessonsRes = http.get(`${BASE_URL}/api/student/lessons?page=1`, { headers });
  check(lessonsRes, { "lessons 200": (r) => r.status === 200 });
  sleep(0.5);

  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { "health ok": (r) => r.status === 200 || r.status === 503 });

  sleep(1);
}
