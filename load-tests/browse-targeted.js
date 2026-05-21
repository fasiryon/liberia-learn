// Targeted browse test — validates NR-4C latency + cold-start fixes.
// Mirrors the setup warm and ramp strategy from k6-config.js at 200 VU scale.
import { student_browse } from "./scenarios/student-browse.js";
import { SharedArray } from "k6/data";
import { sleep } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

const tokens = new SharedArray("students_warm", function () {
  return JSON.parse(open("./fixtures/student-tokens.json"));
});

// Mirrors k6-config.js setup(): Phase 1 sequential (L2 warm) + Phase 2 concurrent burst (instance warm).
export function setup() {
  // Phase 1: sequential warm (100 → L2 Redis). ~40s.
  const warmCount = Math.min(100, tokens.length);
  for (let i = 0; i < warmCount; i++) {
    const { token } = tokens[i];
    http.get(`${BASE_URL}/api/student/today`, {
      headers: { Cookie: `__Secure-next-auth.session-token=${token}` },
    });
  }
  // Phase 2: concurrent burst (200 → spin up ~20 Vercel instances). ~2s.
  const burstRequests = tokens.slice(0, Math.min(200, tokens.length)).map(({ token }) => ({
    method: "GET",
    url: `${BASE_URL}/api/student/today`,
    params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
  }));
  http.batch(burstRequests);
  // Phase 3: hold 30s so booting instances finish Prisma pool init.
  sleep(30);
}

export const options = {
  setupTimeout: "2m",
  scenarios: {
    browse: {
      executor: "ramping-vus",
      exec: "browse",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },   // let settled instances absorb initial load
        { duration: "60s", target: 200 },  // ramp to peak
        { duration: "30s", target: 0 },    // ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export function browse() {
  student_browse();
}
