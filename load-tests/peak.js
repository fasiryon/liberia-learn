import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { splitEnv, credentialFor, loginWithCredentials, cookieHeader } from "./lib/auth.js";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const AI_ENABLED = (__ENV.LOAD_TEST_AI_ENABLED || "false").toLowerCase() === "true";
const USE_TOKEN_POOL = (__ENV.LOAD_TEST_USE_TOKEN_POOL || "true").toLowerCase() === "true";
const TOKEN_FIXTURE = __ENV.LOAD_TEST_TOKEN_FIXTURE || "fixtures/student-tokens.json";
const STUDENT_EMAILS = splitEnv("STUDENT_EMAILS", "STUDENT_EMAIL");
const STUDENT_PASSWORDS = splitEnv("STUDENT_PASSWORDS", "STUDENT_PASSWORD", "PASSWORD");
const LESSON_ID = __ENV.LOAD_TEST_LESSON_ID || "";

const tokens = USE_TOKEN_POOL
  ? new SharedArray("students", function () {
      try {
        return JSON.parse(open(TOKEN_FIXTURE));
      } catch {
        return [];
      }
    })
  : null;

if (!USE_TOKEN_POOL) {
  if (STUDENT_EMAILS.length === 0 || STUDENT_PASSWORDS.length === 0 || !LESSON_ID) {
    exec.test.abort(
      "Set STUDENT_EMAILS/STUDENT_PASSWORDS and LOAD_TEST_LESSON_ID, or LOAD_TEST_USE_TOKEN_POOL=true with token fixture."
    );
  }
} else if (!tokens || tokens.length === 0) {
  exec.test.abort(
    `Token pool empty. Run generate-load-test-tokens.ts (fixture: load-tests/${TOKEN_FIXTURE}).`
  );
}

if (!LESSON_ID) {
  exec.test.abort("Set LOAD_TEST_LESSON_ID before running peak load.");
}

export const options = {
  scenarios: {
    mass_login: {
      executor: "ramping-vus",
      stages: [
        { duration: "1m", target: 5000 },
        { duration: "4m", target: 5000 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.05"],
    "http_req_duration{endpoint:student_today_api}": ["p(95)<5000"],
  },
};

function quizPayload() {
  const questions = [1, 2, 3, 4, 5].map((index) => ({
    id: `peak-q-${index}`,
    question: `Peak validation question ${index}`,
    options: ["A", "B", "C", "D"],
    correctIndex: 0,
    explanation: "Peak validation explanation.",
  }));

  return JSON.stringify({
    quizId: `peak-${__VU}-${__ITER}`,
    startedAt: new Date(Date.now() - 30000).toISOString(),
    questions,
    answers: questions.map((question) => ({
      questionId: question.id,
      selectedIndex: 0,
    })),
  });
}

let vuSessionToken = null;

function ensureSession() {
  if (USE_TOKEN_POOL) {
    const entry = tokens[__VU % tokens.length];
    vuSessionToken = entry?.token || null;
    return Boolean(vuSessionToken);
  }

  if (vuSessionToken) return true;

  const email = credentialFor(STUDENT_EMAILS, __VU);
  const password = credentialFor(STUDENT_PASSWORDS, __VU);
  const result = loginWithCredentials(
    BASE_URL,
    email,
    password,
    `${BASE_URL}/student/today`,
    { scenario: "mass_login" }
  );
  if (result.token) vuSessionToken = result.token;
  return result.ok;
}

export default function () {
  if (!ensureSession()) {
    sleep(1);
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    ...cookieHeader(vuSessionToken),
  };

  group("lesson opens", () => {
    const page = http.get(`${BASE_URL}/student/today`, {
      headers: cookieHeader(vuSessionToken),
      tags: { scenario: "lesson_open", endpoint: "student_today_page" },
    });
    check(page, { "student page available": (r) => r.status === 200 });

    const api = http.get(`${BASE_URL}/api/student/today`, {
      headers,
      tags: { scenario: "lesson_open", endpoint: "student_today_api" },
      responseCallback: http.expectedStatuses(200, 401, 403, 429),
    });
    check(api, { "student today handled": (r) => [200, 401, 403, 429].includes(r.status) });
  });

  group("quiz submits", () => {
    const res = http.post(
      `${BASE_URL}/api/student/lessons/${LESSON_ID}/quiz/submit`,
      quizPayload(),
      {
        headers,
        tags: { scenario: "quiz_submit", endpoint: "quiz_submit" },
        responseCallback: http.expectedStatuses(200, 401, 404, 429),
      }
    );
    check(res, {
      "quiz submit completed or expected constraint": (r) =>
        [200, 401, 404, 429].includes(r.status),
    });
  });

  if (AI_ENABLED && __VU % 10 === 0) {
    const res = http.post(
      `${BASE_URL}/api/student/tutor`,
      JSON.stringify({
        subject: "Mathematics",
        strandKey: "numbers",
        lessonTitle: "Peak validation lesson",
        lessonContent: "Add and compare whole numbers.",
        question: "Explain this in simple steps.",
        gradeLevel: 4,
        requestType: "explain",
      }),
      {
        headers,
        tags: { scenario: "ai_tutor", endpoint: "student_tutor" },
        responseCallback: http.expectedStatuses(200, 429, 503),
      }
    );
    check(res, {
      "ai tutor response or expected rate limit": (r) => [200, 429, 503].includes(r.status),
    });
  }

  sleep(1);
}
