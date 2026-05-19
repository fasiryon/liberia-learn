/**
 * Scenario 3: AI tutor concurrent queries
 *
 * Simulates students asking the AI tutor questions during lessons.
 * Validates circuit breaker and budget guard behaviour under concurrent load.
 * Expects graceful fallback (not 500) when AI budget is exhausted.
 */

import { SharedArray } from "k6/data";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";

// Load token pool once, shared across all VUs
const tokens = new SharedArray("students", function () {
  return JSON.parse(open("../fixtures/student-tokens.json"));
});

const tutorFallbacks = new Counter("tutor_fallback_responses");
const tutorDuration = new Trend("tutor_request_duration", true);

const SAMPLE_QUESTIONS = [
  "Can you explain fractions to me?",
  "What is the water cycle?",
  "Help me understand photosynthesis",
  "How do I solve this equation: 2x + 3 = 11?",
  "What happened during the First Liberian Civil War?",
];

export function ai_tutor() {
  const { token } = tokens[__VU % tokens.length];
  const question = SAMPLE_QUESTIONS[Math.floor(Math.random() * SAMPLE_QUESTIONS.length)];

  const headers = {
    "Content-Type": "application/json",
    Cookie: `next-auth.session-token=${token}`,
  };

  const res = http.post(
    `${BASE_URL}/api/student/tutor`,
    JSON.stringify({
      subject: "MATHEMATICS",
      strandKey: "fractions",
      lessonTitle: "Understanding Fractions",
      lessonContent: "A fraction represents part of a whole...",
      question,
      gradeLevel: 5,
      masteryState: "NOT_ASSESSED",
      proficiencyState: "NOT_ASSESSED",
      gradeBand: "upper_primary",
      requestType: "explain",
    }),
    { headers }
  );

  tutorDuration.add(res.timings.duration);

  const ok = check(res, {
    "tutor responds": (r) => [200, 404, 429, 503].includes(r.status),
    "no hard 500": (r) => r.status !== 500,
  });

  // 404 = flag disabled, 429 = rate limited, 503 = budget exhausted — all acceptable under load
  if (res.status === 200) {
    const body = res.json();
    if (body && body.hadFallback) tutorFallbacks.add(1);
  }

  sleep(Math.random() * 3 + 2);
}
