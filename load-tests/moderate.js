import http from "k6/http";
import { check, group, sleep } from "k6";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const AI_ENABLED = (__ENV.LOAD_TEST_AI_ENABLED || "false").toLowerCase() === "true";

const STUDENT_EMAILS = splitEnv("STUDENT_EMAILS", "STUDENT_EMAIL");
const TEACHER_EMAILS = splitEnv("TEACHER_EMAILS", "TEACHER_EMAIL");
const ADMIN_EMAILS = splitEnv("ADMIN_EMAILS", "ADMIN_EMAIL");
const STUDENT_PASSWORDS = splitEnv("STUDENT_PASSWORDS", "STUDENT_PASSWORD", "PASSWORD");
const TEACHER_PASSWORDS = splitEnv("TEACHER_PASSWORDS", "TEACHER_PASSWORD", "PASSWORD");
const ADMIN_PASSWORDS = splitEnv("ADMIN_PASSWORDS", "ADMIN_PASSWORD", "PASSWORD");
const LESSON_ID = __ENV.LOAD_TEST_LESSON_ID || "";

if (
  STUDENT_EMAILS.length === 0 ||
  TEACHER_EMAILS.length === 0 ||
  ADMIN_EMAILS.length === 0 ||
  STUDENT_PASSWORDS.length === 0 ||
  TEACHER_PASSWORDS.length === 0 ||
  ADMIN_PASSWORDS.length === 0 ||
  !LESSON_ID
) {
  exec.test.abort(
    "Set STUDENT/TEACHER/ADMIN credential pools and LOAD_TEST_LESSON_ID before running moderate load."
  );
}

export const options = {
  scenarios: {
    student: {
      executor: "constant-vus",
      vus: 700,
      duration: "10m",
      exec: "studentFlow",
    },
    teacher: {
      executor: "constant-vus",
      vus: 200,
      duration: "10m",
      exec: "teacherFlow",
    },
    admin: {
      executor: "constant-vus",
      vus: 100,
      duration: "10m",
      exec: "adminFlow",
    },
  },
  thresholds: {
    "http_req_duration{endpoint:student_today_page}": ["p(95)<2000"],
    "http_req_duration{endpoint:student_today_api}": ["p(95)<2000"],
    "http_req_duration{endpoint:quiz_submit}": ["p(99)<10000"],
    http_req_failed: ["rate<0.01"],
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

function login(email, password, callbackUrl) {
  if (!email || !password) return false;
  const csrf = http.get(`${BASE_URL}/api/auth/csrf`, {
    tags: { scenario: "login", endpoint: "auth_csrf" },
  });
  const token = csrf.json("csrfToken");
  if (!token) return false;

  const res = http.post(
    `${BASE_URL}/api/auth/callback/credentials?json=true`,
    {
      csrfToken: token,
      email,
      password,
      callbackUrl,
      json: "true",
    },
    {
      redirects: 0,
      tags: { scenario: "login", endpoint: "credentials_login" },
      responseCallback: http.expectedStatuses(200, 302, 401, 429),
    }
  );
  return check(res, {
    "login accepted": (r) => r.status === 200 || r.status === 302,
  });
}

function quizPayload() {
  const questions = [1, 2, 3, 4, 5].map((index) => ({
    id: `load-q-${index}`,
    question: `Load validation question ${index}`,
    options: ["A", "B", "C", "D"],
    correctIndex: 0,
    explanation: "Load validation explanation.",
  }));

  return JSON.stringify({
    quizId: `load-${__VU}-${__ITER}`,
    startedAt: new Date(Date.now() - 30000).toISOString(),
    questions,
    answers: questions.map((question) => ({
      questionId: question.id,
      selectedIndex: 0,
    })),
  });
}

// Login once per VU — reuse session cookie across iterations.
let studentSessionOk = false;
let teacherSessionOk = false;
let adminSessionOk = false;

export function studentFlow() {
  if (!studentSessionOk) {
    const ok = login(
      credentialFor(STUDENT_EMAILS),
      credentialFor(STUDENT_PASSWORDS),
      `${BASE_URL}/student/today`
    );
    if (!ok) { sleep(1); return; }
    studentSessionOk = true;
  }

  group("lesson view", () => {
    const page = http.get(`${BASE_URL}/student/today`, {
      tags: { scenario: "lesson_view", endpoint: "student_today_page" },
    });
    check(page, { "student page available": (r) => r.status === 200 });

    const api = http.get(`${BASE_URL}/api/student/today`, {
      tags: { scenario: "lesson_view", endpoint: "student_today_api" },
    });
    check(api, { "student today api ok": (r) => r.status === 200 });
  });

  group("quiz submit", () => {
    const res = http.post(`${BASE_URL}/api/student/lessons/${LESSON_ID}/quiz/submit`, quizPayload(), {
      headers: { "Content-Type": "application/json" },
      tags: { scenario: "quiz_submit", endpoint: "quiz_submit" },
    });
    check(res, {
      "quiz submit completed": (r) => r.status === 200,
    });
  });

  if (AI_ENABLED && __ITER % 10 === 0) {
    group("ai tutor request", () => {
      const res = http.post(
        `${BASE_URL}/api/student/tutor`,
        JSON.stringify({
          subject: "Mathematics",
          strandKey: "numbers",
          lessonTitle: "Load validation lesson",
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
      check(res, {
        "ai tutor response or expected rate limit": (r) => r.status === 200 || r.status === 429,
      });
    });
  }

  sleep(1);
}

export function teacherFlow() {
  if (!teacherSessionOk) {
    const ok = login(
      credentialFor(TEACHER_EMAILS),
      credentialFor(TEACHER_PASSWORDS),
      `${BASE_URL}/teacher/dashboard`
    );
    if (!ok) { sleep(1); return; }
    teacherSessionOk = true;
  }
  const res = http.get(`${BASE_URL}/teacher/dashboard`, {
    tags: { scenario: "teacher_dashboard", endpoint: "teacher_dashboard" },
  });
  check(res, { "teacher dashboard page available": (r) => r.status === 200 });
  sleep(1);
}

export function adminFlow() {
  if (!adminSessionOk) {
    const ok = login(
      credentialFor(ADMIN_EMAILS),
      credentialFor(ADMIN_PASSWORDS),
      `${BASE_URL}/admin`
    );
    if (!ok) { sleep(1); return; }
    adminSessionOk = true;
  }
  const res = http.get(`${BASE_URL}/admin`, {
    tags: { scenario: "admin_dashboard", endpoint: "admin_dashboard" },
  });
  check(res, { "admin dashboard page available": (r) => r.status === 200 });
  sleep(1);
}
