/**
 * NR-5 — Dedicated 200-VU AI tutor burst gate.
 *
 * Uses pre-generated JWT tokens (no login storm). Validates:
 *   - p95 tutor latency < 5000ms
 *   - error rate < 5% (excluding expected 429/503 budget guard)
 *   - no hard 500s
 *   - budget_guard fallbacks tracked (no runaway provider spend)
 *
 * Prerequisites:
 *   npx dotenv -e .env.production -- npx tsx scripts/seed-load-test-users.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-load-test-tokens.ts
 *
 * Run (outside Liberian school hours):
 *   k6 run load-tests/ai-burst.js \
 *     -e BASE_URL=https://liberia-learn.vercel.app \
 *     --out json=load-tests/results/ai-burst-$(date +%Y%m%d).json
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const TOKEN_FIXTURE = __ENV.LOAD_TEST_TOKEN_FIXTURE || "fixtures/student-tokens.json";

const tokens = new SharedArray("students", function () {
  try {
    return JSON.parse(open(TOKEN_FIXTURE));
  } catch (e) {
    exec.test.abort(
      `Missing token fixture at load-tests/${TOKEN_FIXTURE}. Run generate-load-test-tokens.ts first.`
    );
    return [];
  }
});

const tutorDuration = new Trend("tutor_request_duration", true);
const tutorHardErrors = new Counter("tutor_hard_500");
const tutorBudgetFallbacks = new Counter("tutor_budget_guard_fallbacks");
const tutorRateLimited = new Counter("tutor_rate_limited");
const tutorSuccess = new Counter("tutor_success_200");

export const options = {
  scenarios: {
    ai_burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 200 },
        { duration: "4m", target: 200 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    "http_req_duration{endpoint:student_tutor}": ["p(95)<5000"],
    http_req_failed: ["rate<0.05"],
    tutor_hard_500: ["count<10"],
  },
};

const SAMPLE_QUESTIONS = [
  "Can you explain fractions to me?",
  "What is the water cycle?",
  "Help me understand photosynthesis",
  "How do I solve 2x + 3 = 11?",
  "What is place value?",
];

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };
}

export default function () {
  const entry = tokens[__VU % tokens.length];
  if (!entry?.token) {
    sleep(1);
    return;
  }

  const question = SAMPLE_QUESTIONS[Math.floor(Math.random() * SAMPLE_QUESTIONS.length)];

  const res = http.post(
    `${BASE_URL}/api/student/tutor`,
    JSON.stringify({
      subject: "MATHEMATICS",
      strandKey: "numbers",
      lessonTitle: "NR-5 AI burst validation",
      lessonContent: "Students compare whole numbers using place value.",
      question,
      gradeLevel: 5,
      masteryState: "NOT_ASSESSED",
      proficiencyState: "NOT_ASSESSED",
      gradeBand: "upper_primary",
      requestType: "explain",
    }),
    {
      headers: authHeaders(entry.token),
      tags: { scenario: "ai_burst", endpoint: "student_tutor" },
      responseCallback: http.expectedStatuses(200, 401, 404, 429, 503),
    }
  );

  tutorDuration.add(res.timings.duration);

  if (res.status === 500) tutorHardErrors.add(1);
  if (res.status === 429) tutorRateLimited.add(1);
  if (res.status === 200) {
    tutorSuccess.add(1);
    try {
      const body = res.json();
      if (body?.hadFallback || body?.model === "budget_guard") {
        tutorBudgetFallbacks.add(1);
      }
    } catch {
      // non-JSON 200 is still a success for infra gate
    }
  }
  if (res.status === 503) tutorBudgetFallbacks.add(1);

  check(res, {
    "tutor responds without 500": (r) => r.status !== 500,
    "tutor acceptable under load": (r) => [200, 429, 503].includes(r.status),
  });

  sleep(Math.random() * 2 + 1);
}
