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
 * Two-phase pre-warm: populate L2 Redis for every token this run can use,
 * then force-spin additional Vercel instances.
 *
 * Phase 1 (batched, PREWARM_BATCH_SIZE-concurrent, warmCount tokens): each
 * batch's concurrent requests populate L2 Redis via the real DB fallback.
 * Batch size matches MAX_CONCURRENT_DB_FALLBACKS in lib/cache/redisCache.ts
 * so a batch landing on a single Vercel instance never self-inflicts
 * FALLBACK_LIMIT_EXCEEDED. warmCount = min(1000, tokens.length) — for a
 * 1000-VU run, student_browse.js selects tokens[__VU % tokens.length], which
 * for VU 1..1000 against a 1800-token pool only ever selects indices 1..1000
 * (verified: 1000 < 1800, so no wraparound) — token indices beyond warmCount
 * are never touched by this run, so pre-warming them would be wasted work.
 *
 * This exists because NR-4's 2026-07-31 production run found the prior
 * 50-student pre-warm left ~950 VUs hitting a genuinely cold cache on their
 * first request as the ramp introduced them, and the resulting DB-fallback
 * serialization (then MAX_CONCURRENT_DB_FALLBACKS=1) was the dominant
 * contributor to that run's 19.97s p95 (see docs/LOAD_TEST_RESULTS.md).
 * Pre-warming all tokens this run uses converts the browse scenario into a
 * measurement of steady-state serving capacity. That is a deliberate choice,
 * not an oversight: a real national rollout doesn't have every student
 * request their first page in the same few minutes either. Cold-burst
 * behavior (e.g. a whole school logging in at 8am) is a different, real
 * scenario this run does not test — flagged as a follow-up, not silently
 * folded into this measurement.
 *
 * Phase 2 (concurrent burst, 50 already-warm students): L2 is warm from
 * Phase 1, so every request hits Redis only, no DB fallback. Vercel must
 * allocate additional instances to absorb the burst; each warms its L1 from
 * L2. Setup completes immediately so VUs arrive on still-warm instances —
 * adding a sleep here causes Vercel to scale-to-zero the pre-warmed
 * instances before the browse ramp starts, which reverses the benefit.
 */
export function setup() {
  const PREWARM_BATCH_SIZE = 3; // matches MAX_CONCURRENT_DB_FALLBACKS (lib/cache/redisCache.ts)
  const warmCount = Math.min(1000, tokens.length);

  for (let i = 0; i < warmCount; i += PREWARM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + PREWARM_BATCH_SIZE).map(({ token }) => ({
      method: "GET",
      url: `${BASE_URL}/api/student/today`,
      params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
    }));
    http.batch(batch);
  }

  // Phase 2: concurrent burst — L2 is now warm from Phase 1, so each request
  // hits Redis (no DB needed → no FALLBACK_LIMIT_EXCEEDED). Vercel must spin up
  // additional instances to absorb the concurrent load; each new instance warms
  // its L1 from L2. Without this phase, the browse ramp cold-starts 10+ instances
  // simultaneously during the 50→500 VU jump, causing 5-15s queuing delays that
  // blow the p(95) threshold. ~50 concurrent × ~500ms = ~1s total.
  const burstRequests = tokens.slice(0, Math.min(50, tokens.length)).map(({ token }) => ({
    method: 'GET',
    url: `${BASE_URL}/api/student/today`,
    params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
  }));
  http.batch(burstRequests);
}

export const options = {
  // Raised from 2m: pre-warming ~1000 tokens in batches of 3 (~334 batches)
  // against real production DB latency for the full 7-query todayData path
  // (not the cheap studentMeta-only path the old 50-token/2m budget was
  // tuned against) needs real margin. Empirically timed before trusting this
  // for a full run — see docs/LOAD_TEST_RESULTS.md.
  setupTimeout: "15m",
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
