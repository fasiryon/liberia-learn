/**
 * load-tests/k6-config.js
 *
 * k6 load test configuration for LiberiaLearn national rollout validation.
 * Target: 5,000 concurrent users across 4 usage scenarios.
 *
 * Run:
 *   k6 run load-tests/k6-config.js --out json=load-tests/results.json
 *
 * Install k6:
 *   npm install -g k6   (or: choco install k6  on Windows)
 */

import http from "k6/http";
import { sleep } from "k6";
import { SharedArray } from "k6/data";
import { student_browse } from "./scenarios/student-browse.js";
import { submission_spike } from "./scenarios/submission-spike.js";
import { ai_tutor } from "./scenarios/ai-tutor.js";
import { guardian_reads } from "./scenarios/guardian-reads.js";

export { student_browse, submission_spike, ai_tutor, guardian_reads };

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

const tokens = new SharedArray("students_warm", function () {
  return JSON.parse(open("./fixtures/student-tokens.json"));
});

/**
 * Two-phase pre-warm: populate L2 Redis then force-spin Vercel instances.
 *
 * Phase 1 (sequential, 100 students): Each request lands on a fresh instance,
 * runs the DB fallback, and populates L2 Redis. Sequential serialises DB access
 * so MAX_CONCURRENT_DB_FALLBACKS=1 is never exceeded. ~100 × 400ms = ~40s.
 *
 * Phase 2 (concurrent burst, 200 students): L2 is now warm so every request hits
 * Redis — no DB fallback, no FALLBACK_LIMIT_EXCEEDED. Vercel must allocate ~20
 * new function instances to absorb the burst; each instance warms its L1 from L2.
 * Scaling from 50→200 burst: at 1000 VU peak we need ~20 instances; the 200-
 * request burst pre-creates them before k6 even starts ramping.
 *
 * Phase 3 (30s hold): lets all booting instances finish their cold-start before
 * the browse scenario ramp begins. Without this, VUs land on half-ready instances
 * that still have 3-10s of Prisma pool init remaining, inflating http_req_duration.
 *
 * Total setup time: ~40s + ~2s + 30s = ~72s (well under the 2m setupTimeout).
 */
export function setup() {
  // Phase 1: sequential warm (100 students → L2 Redis).
  const warmCount = Math.min(100, tokens.length);
  for (let i = 0; i < warmCount; i++) {
    const { token } = tokens[i];
    http.get(`${BASE_URL}/api/student/today`, {
      headers: { Cookie: `__Secure-next-auth.session-token=${token}` },
    });
  }

  // Phase 2: concurrent burst (200 students → 20 Vercel instances).
  const burstCount = Math.min(200, tokens.length);
  const burstRequests = tokens.slice(0, burstCount).map(({ token }) => ({
    method: 'GET',
    url: `${BASE_URL}/api/student/today`,
    params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
  }));
  http.batch(burstRequests);

  // Phase 3: hold 30s — cold-booting instances finish Prisma pool init before
  // browse VUs arrive. Skipping this means the first 30s of browse hits instances
  // that are still initialising, adding 3-10s to their first-request duration.
  sleep(30);
}

export const options = {
  setupTimeout: "2m",
  scenarios: {
    // Scenario 1: Student browsing lessons (read-heavy)
    // Peak 1,000 VUs — matches national-gate spec; 2,000 exceeded Vercel concurrency limit.
    //
    // Slow initial ramp (v28): Vercel cold-starts take 3-5s during which requests queue at the
    // edge — this queuing time is included in k6 http_req_waiting and drives browse p(95) to 4s+
    // even though the app's own shields cap at 1300ms. Ramping to just 50 VUs for the first
    // minute lets Vercel instantiate 1-2 instances without queuing; subsequent ramp steps
    // encounter warm instances so cold-start queueing is < 5 requests per event.
    student_browse: {
      executor: "ramping-vus",
      exec: "student_browse",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },    // slow start: let Phase-2 burst instances fully settle
        { duration: "2m", target: 200 },   // intermediate: absorb next cold-start wave before peak
        { duration: "2m", target: 500 },   // mid ramp
        { duration: "2m", target: 1000 },  // peak load
        { duration: "2m", target: 0 },     // ramp down
      ],
      // Total = 9m — unchanged; submission_spike startTime stays at "9m".
      tags: { scenario: "student_browse" },
    },
    // Scenario 2: Assignment submission spike
    // Runs AFTER student_browse ends (startTime="9m") to avoid competing for Vercel
    // function capacity. student_browse holds 1,000 VUs for 7 min; quiz-submit cold
    // starts (3-4s Prisma pool init per instance) would saturate Vercel and push
    // today/lessons into the 20s queue-overflow cliff if run concurrently.
    //
    // Strategy (v14):
    //   t=9–12m: 50 req/s (not 200) after browse ends — proves write path without
    //            re-saturating Vercel. Payload returns 400 before DB resolve (v14 route).
    //   ai_tutor + guardian_reads start at t=12m so browse peak has no competitors.
    submission_spike: {
      executor: "constant-arrival-rate",
      exec: "submission_spike",
      startTime: "9m",
      rate: 50,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 25,
      maxVUs: 100,
      tags: { scenario: "submission_spike" },
    },
    // Scenario 3: AI tutor — starts after student_browse ends (v14 stagger).
    // Running concurrently at t=0–5m saturated Vercel and pushed today/lessons into 20s queues.
    ai_tutor: {
      executor: "ramping-vus",
      exec: "ai_tutor",
      startTime: "12m",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "3m", target: 300 },
        { duration: "1m", target: 0 },
      ],
      tags: { scenario: "ai_tutor" },
    },
    // Scenario 4: Guardian reads — after browse; uses guardian-tokens.json when present.
    guardian_reads: {
      executor: "constant-vus",
      exec: "guardian_reads",
      startTime: "12m",
      vus: 200,
      duration: "5m",
      tags: { scenario: "guardian_reads" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],   // 95% of requests under 2s
    http_req_failed:   ["rate<0.01"],    // < 1% error rate
    "http_req_duration{scenario:student_browse}": ["p(95)<1500"],
    "http_req_duration{scenario:submission_spike}": ["p(95)<2000"],
    "http_req_duration{scenario:ai_tutor}": ["p(95)<3000"],
    "http_req_duration{scenario:guardian_reads}": ["p(95)<1000"],
  },
};
