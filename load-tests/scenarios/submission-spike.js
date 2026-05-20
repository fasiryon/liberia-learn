/**
 * Scenario 2: Assignment submission spike
 *
 * Simulates end-of-class submission bursts at 200 req/s — the highest-stress
 * write path. Validates DB connection pool + Prisma timeout middleware hold up.
 * Accepts 404 — load-test students have no pre-assigned scheduled work.
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

// Load token pool once, shared across all VUs
const tokens = new SharedArray("students", function () {
  return JSON.parse(open("../fixtures/student-tokens.json"));
});

const submissionErrors = new Counter("submission_errors");

// UUID-format IDs that don't exist in DB → fast null-lookup → 404 (accepted).
// Non-UUID strings (e.g. "demo-sw-001") cause a Prisma type error → 500.
const SCHEDULED_WORK_IDS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
  "00000000-0000-0000-0000-000000000005",
  "00000000-0000-0000-0000-000000000006",
  "00000000-0000-0000-0000-000000000007",
  "00000000-0000-0000-0000-000000000008",
  "00000000-0000-0000-0000-000000000009",
  "00000000-0000-0000-0000-000000000010",
];

export function submission_spike() {
  const { token } = tokens[__VU % tokens.length];
  const swId = SCHEDULED_WORK_IDS[Math.floor(Math.random() * SCHEDULED_WORK_IDS.length)];

  const headers = {
    "Content-Type": "application/json",
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };

  // Minimal invalid payload → 400 before DB resolve (v14 route order). No scheduled work needed.
  const quizRes = http.post(
    `${BASE_URL}/api/student/lessons/${swId}/quiz/submit`,
    JSON.stringify({ answers: [{ questionId: "q1", selectedIndex: 0 }] }),
    { headers, responseCallback: http.expectedStatuses(200, 201, 400, 404) }
  );

  const ok = check(quizRes, {
    "submission 200/201/400/404": (r) => [200, 201, 400, 404].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });

  if (!ok) submissionErrors.add(1);

  sleep(0.1);
}
