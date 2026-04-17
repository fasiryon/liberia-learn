import http from "k6/http";
import { check, group, sleep } from "k6";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const AI_ENABLED = (__ENV.LOAD_TEST_AI_ENABLED || "false").toLowerCase() === "true";
const STUDENT_EMAILS = splitEnv("STUDENT_EMAILS", "STUDENT_EMAIL");
const STUDENT_PASSWORDS = splitEnv("STUDENT_PASSWORDS", "STUDENT_PASSWORD", "PASSWORD");
const LESSON_ID = __ENV.LOAD_TEST_LESSON_ID || "";

if (STUDENT_EMAILS.length === 0 || STUDENT_PASSWORDS.length === 0 || !LESSON_ID) {
  exec.test.abort("Set STUDENT_EMAILS/STUDENT_PASSWORDS and LOAD_TEST_LESSON_ID before running peak load.");
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
  },
};

function splitEnv(...names) {
  for (const name of names) {
    const raw = __ENV[name];
    if (raw) {
      return raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function credentialFor(list) {
  if (list.length === 0) return "";
  return list[(__VU - 1) % list.length];
}

function login() {
  const email = credentialFor(STUDENT_EMAILS);
  const password = credentialFor(STUDENT_PASSWORDS);
  if (!email || !password) return false;

  const csrf = http.get(`${BASE_URL}/api/auth/csrf`, {
    tags: { scenario: "mass_login", endpoint: "auth_csrf" },
  });
  const token = csrf.json("csrfToken");
  if (!token) return false;

  const res = http.post(
    `${BASE_URL}/api/auth/callback/credentials?json=true`,
    {
      csrfToken: token,
      email,
      password,
      callbackUrl: `${BASE_URL}/student/today`,
      json: "true",
    },
    {
      redirects: 0,
      tags: { scenario: "mass_login", endpoint: "credentials_login" },
      responseCallback: http.expectedStatuses(200, 302, 401, 429),
    }
  );
  return check(res, {
    "login accepted or rate limited": (r) => [200, 302, 429].includes(r.status),
  });
}

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

// Login once per VU — reuse session cookie across iterations.
let vuSessionEstablished = false;

export default function () {
  if (!vuSessionEstablished) {
    group("mass login", () => {
      if (login()) {
        vuSessionEstablished = true;
      }
    });
    if (!vuSessionEstablished) { sleep(1); return; }
  }

  group("lesson opens", () => {
    const page = http.get(`${BASE_URL}/student/today`, {
      tags: { scenario: "lesson_open", endpoint: "student_today_page" },
    });
    check(page, { "student page available": (r) => r.status === 200 });

    const api = http.get(`${BASE_URL}/api/student/today`, {
      tags: { scenario: "lesson_open", endpoint: "student_today_api" },
    });
    check(api, { "student today handled": (r) => [200, 401, 403].includes(r.status) });
  });

  group("quiz submits", () => {
    const res = http.post(`${BASE_URL}/api/student/lessons/${LESSON_ID}/quiz/submit`, quizPayload(), {
      headers: { "Content-Type": "application/json" },
      tags: { scenario: "quiz_submit", endpoint: "quiz_submit" },
    });
    check(res, {
      "quiz submit completed": (r) => r.status === 200,
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
        headers: { "Content-Type": "application/json" },
        tags: { scenario: "ai_tutor", endpoint: "student_tutor" },
        responseCallback: http.expectedStatuses(200, 429),
      }
    );
    check(res, { "ai tutor response or expected rate limit": (r) => r.status === 200 || r.status === 429 });
  }

  sleep(1);
}
