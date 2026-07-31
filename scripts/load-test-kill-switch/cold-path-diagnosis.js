/**
 * Diagnose what actually dominates cold-request latency, isolating
 * concurrency-driven contention from inherent single-request latency
 * (Redis GET timeout, single DB query, Vercel cold start). Uses tokens
 * from the tail of the pool (near index 1800) that nothing else in this
 * session has touched, so every request here is a genuine first-touch.
 *
 * Test A: sequential single requests (no contention) - baseline latency.
 * Test B: increasing concurrency (2, 5, 10, 20) on fresh tokens each step -
 * shows whether/where latency degrades as concurrent cold misses rise.
 *
 * Run: k6 run scripts/load-test-kill-switch/cold-path-diagnosis.js
 */
import http from "k6/http";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

const tokens = new SharedArray("students_diag", function () {
  const all = JSON.parse(open("../../load-tests/fixtures/student-tokens.json"));
  // Tail of the pool - untouched by the earlier 30-token validation (indices 1-30)
  // and unlikely to have been warm from the real NR-4 run given cache TTLs expired.
  return all.slice(1700, 1800);
});

export const options = {
  scenarios: {
    default: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "10m",
    },
  },
};

function reqFor(token) {
  return {
    method: "GET",
    url: `${BASE_URL}/api/student/today`,
    params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
  };
}

export default function () {
  let idx = 0;

  console.log("=== TEST A: sequential single requests (baseline, no contention) ===");
  const sequentialTimings = [];
  for (let i = 0; i < 8; i++) {
    const { token } = tokens[idx++];
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/student/today`, {
      headers: { Cookie: `__Secure-next-auth.session-token=${token}` },
    });
    const elapsed = Date.now() - start;
    sequentialTimings.push(elapsed);
    console.log(`seq req ${i + 1}: ${elapsed}ms, status=${res.status}`);
  }
  const seqAvg = sequentialTimings.reduce((a, b) => a + b, 0) / sequentialTimings.length;
  console.log(`sequential avg: ${seqAvg.toFixed(0)}ms, max: ${Math.max(...sequentialTimings)}ms`);

  console.log("=== TEST B: increasing concurrency on fresh cold tokens ===");
  for (const concurrency of [2, 5, 10, 20]) {
    const batchTokens = tokens.slice(idx, idx + concurrency);
    idx += concurrency;
    const batch = batchTokens.map(({ token }) => reqFor(token));
    const start = Date.now();
    const responses = http.batch(batch);
    const elapsed = Date.now() - start;
    const statuses = responses.map((r) => r.status).join(",");
    const maxSingle = Math.max(...responses.map((r) => r.timings.duration));
    console.log(
      `concurrency=${concurrency}: batch_total=${elapsed}ms, slowest_single_req=${maxSingle.toFixed(0)}ms, statuses=${statuses}`
    );
  }
}
