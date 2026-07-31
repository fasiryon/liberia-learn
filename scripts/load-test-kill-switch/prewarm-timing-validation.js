/**
 * Small-scale, real-production timing validation for the broadened k6-config.js
 * pre-warm (PR #68, deployed 2026-07-31). Replicates the exact batched pre-warm
 * logic (PREWARM_BATCH_SIZE=3, matching MAX_CONCURRENT_DB_FALLBACKS) against a
 * SMALL subset of real tokens (default 30 = 10 batches), not the full 1000, to:
 *   1. Confirm no spurious FALLBACK_LIMIT_EXCEEDED within a batch of 3.
 *   2. Get real per-batch timing to extrapolate an accurate setupTimeout for
 *      the full 1000-token pre-warm before trusting it on a real NR-4 re-run.
 *   3. Confirm responses contain real data (non-empty items/schedule), not the
 *      degraded empty fallback.
 *
 * Deliberately NOT the full load test - this is validation-only, low request
 * volume, same discipline as scripts/load-test-kill-switch's mock-server tests.
 *
 * Run: k6 run scripts/load-test-kill-switch/prewarm-timing-validation.js
 */
import http from "k6/http";
import { SharedArray } from "k6/data";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const VALIDATE_COUNT = Number(__ENV.VALIDATE_COUNT || 30);
const BATCH_SIZE = Number(__ENV.BATCH_SIZE || 3);

const tokens = new SharedArray("students_validate", function () {
  return JSON.parse(open("../../load-tests/fixtures/student-tokens.json"));
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

export default function () {
  const warmCount = Math.min(VALIDATE_COUNT, tokens.length);
  let emptyResponses = 0;
  let nonEmptyResponses = 0;
  let nonOkResponses = 0;
  const batchTimings = [];

  const overallStart = Date.now();

  for (let i = 0; i < warmCount; i += BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);
    const batch = batchTokens.map(({ token }) => ({
      method: "GET",
      url: `${BASE_URL}/api/student/today`,
      params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
    }));

    const batchStart = Date.now();
    const responses = http.batch(batch);
    const batchElapsed = Date.now() - batchStart;
    batchTimings.push(batchElapsed);

    for (const res of responses) {
      const ok = check(res, { "status 200": (r) => r.status === 200 });
      if (!ok) nonOkResponses++;
      if (res.status === 200) {
        try {
          const body = JSON.parse(res.body);
          const isEmpty = Array.isArray(body.items) && body.items.length === 0 && !body.error;
          if (isEmpty) emptyResponses++;
          else nonEmptyResponses++;
        } catch {
          nonOkResponses++;
        }
      }
    }

    console.log(
      `batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(warmCount / BATCH_SIZE)}: ${batchElapsed}ms, statuses=${responses.map((r) => r.status).join(",")}`
    );
  }

  const overallElapsed = Date.now() - overallStart;
  const avgBatchMs = batchTimings.reduce((a, b) => a + b, 0) / batchTimings.length;
  const maxBatchMs = Math.max(...batchTimings);

  console.log("=== PREWARM TIMING VALIDATION SUMMARY ===");
  console.log(`tokens warmed: ${warmCount}, batch size: ${BATCH_SIZE}, batches: ${batchTimings.length}`);
  console.log(`total elapsed: ${overallElapsed}ms`);
  console.log(`avg batch: ${avgBatchMs.toFixed(0)}ms, max batch: ${maxBatchMs}ms`);
  console.log(`non-200 responses: ${nonOkResponses}`);
  console.log(`empty (degraded/fallback-limited) responses: ${emptyResponses}`);
  console.log(`non-empty (real data) responses: ${nonEmptyResponses}`);
  console.log(`extrapolated for 1000 tokens: ${((1000 / warmCount) * overallElapsed / 1000).toFixed(1)}s`);
}
