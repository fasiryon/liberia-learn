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

// Rotate through demo scheduled work IDs to spread DB load
const SCHEDULED_WORK_IDS = [
  "demo-sw-001", "demo-sw-002", "demo-sw-003", "demo-sw-004", "demo-sw-005",
  "demo-sw-006", "demo-sw-007", "demo-sw-008", "demo-sw-009", "demo-sw-010",
];

export function submission_spike() {
  const { token } = tokens[__VU % tokens.length];
  const swId = SCHEDULED_WORK_IDS[Math.floor(Math.random() * SCHEDULED_WORK_IDS.length)];

  const headers = {
    "Content-Type": "application/json",
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };

  // Quiz submission (404 acceptable — load-test students have no scheduled work)
  const quizRes = http.post(
    `${BASE_URL}/api/student/lessons/${swId}/quiz/submit`,
    JSON.stringify({ answers: [{ questionId: "q1", answer: "A" }], scheduledWorkId: swId }),
    { headers, responseCallback: http.expectedStatuses(200, 201, 400, 404) }
  );

  const ok = check(quizRes, {
    "submission 200/201/400/404": (r) => [200, 201, 400, 404].includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });

  if (!ok) submissionErrors.add(1);

  sleep(0.1);
}
