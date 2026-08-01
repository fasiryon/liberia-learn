/**
 * Diagnose whether cold-request latency degrades over SUSTAINED duration at
 * FIXED, modest concurrency (matching MAX_CONCURRENT_DB_FALLBACKS=3),
 * distinct from the already-confirmed concurrency-level effect
 * (cold-path-diagnosis.js). Uses a fresh token range (index 1400-1700,
 * never touched by any prior test in this investigation) so every request
 * is a genuine first-touch throughout the run, replicating the pre-warm's
 * "many distinct cold keys over several minutes" pattern without the
 * bursty scale of the real 1000-VU ramp.
 *
 * Run alongside scripts/load-test-kill-switch/db-connection-poller.ts to
 * correlate latency trend against real DB connection count over time.
 *
 * Run (through the kill-switch, same abort criteria as production runs):
 *   npx tsx scripts/load-test-kill-switch/supervisor.ts \
 *     --script scripts/load-test-kill-switch/sustained-load-diagnosis.js \
 *     --out scripts/load-test-kill-switch/tmp/sustained-diag.json \
 *     --p95-threshold-ms 10000 --p95-window-s 60 \
 *     --error-rate-threshold 0.05 --error-window-s 30 \
 *     --check-interval-ms 3000 --min-samples 20 \
 *     --event-file scripts/load-test-kill-switch/tmp/sustained-diag-abort-event.json
 */
import http from "k6/http";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const BATCH_SIZE = Number(__ENV.BATCH_SIZE || 3);
const TOKEN_START = Number(__ENV.TOKEN_START || 1400);
const TOKEN_COUNT = Number(__ENV.TOKEN_COUNT || 300);

const tokens = new SharedArray("students_sustained", function () {
  const all = JSON.parse(open("../../load-tests/fixtures/student-tokens.json"));
  return all.slice(TOKEN_START, TOKEN_START + TOKEN_COUNT);
});

export const options = {
  scenarios: {
    default: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "15m",
    },
  },
};

export default function () {
  const runStart = Date.now();
  let batchNum = 0;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    batchNum++;
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);
    const batch = batchTokens.map(({ token }) => ({
      method: "GET",
      url: `${BASE_URL}/api/student/today`,
      params: { headers: { Cookie: `__Secure-next-auth.session-token=${token}` } },
    }));

    const batchStart = Date.now();
    const responses = http.batch(batch);
    const batchElapsed = Date.now() - batchStart;
    const elapsedSinceStart = ((Date.now() - runStart) / 1000).toFixed(1);
    const statuses = responses.map((r) => r.status).join(",");
    const maxSingle = Math.max(...responses.map((r) => r.timings.duration));

    console.log(
      `t=${elapsedSinceStart}s batch ${batchNum}/${Math.ceil(tokens.length / BATCH_SIZE)}: total=${batchElapsed}ms max_single=${maxSingle.toFixed(0)}ms statuses=${statuses}`
    );
  }

  console.log(`=== sustained diagnosis complete: ${batchNum} batches, ${((Date.now() - runStart) / 1000).toFixed(1)}s total ===`);
}
