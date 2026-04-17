import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "https://liberia-learn.vercel.app";
const STUDENT_EMAILS = (__ENV.STUDENT_EMAILS || __ENV.STUDENT_EMAIL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const STUDENT_PASSWORDS = (__ENV.STUDENT_PASSWORDS || __ENV.STUDENT_PASSWORD || __ENV.PASSWORD || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (STUDENT_EMAILS.length === 0 || STUDENT_PASSWORDS.length === 0) {
  exec.test.abort("Set STUDENT_EMAILS/STUDENT_PASSWORDS before running baseline load.");
}

export const options = {
  vus: 100,
  duration: "5m",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

function credentialFor(list) {
  if (list.length === 0) return "";
  return list[(__VU - 1) % list.length];
}

function login() {
  const email = credentialFor(STUDENT_EMAILS);
  const password = credentialFor(STUDENT_PASSWORDS);
  if (!email || !password) return false;

  const csrf = http.get(`${BASE_URL}/api/auth/csrf`, {
    tags: { scenario: "student_login", endpoint: "auth_csrf" },
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
      tags: { scenario: "student_login", endpoint: "credentials_login" },
      // 401/429 are expected under auth rate limiting — not app failures.
      responseCallback: http.expectedStatuses(200, 302, 401, 429),
    }
  );

  return check(res, {
    "student login accepted": (r) => r.status === 200 || r.status === 302,
  });
}

// Login once per VU — reuse session cookie across iterations to avoid
// per-identifier auth rate limiting when all VUs share one credential.
let vuSessionEstablished = false;

export default function () {
  if (!vuSessionEstablished) {
    if (!login()) {
      sleep(1);
      return;
    }
    vuSessionEstablished = true;
  }

  const res = http.get(`${BASE_URL}/student/today`, {
    headers: { "Content-Type": "application/json" },
    tags: { scenario: "lesson_view", endpoint: "student_today_page" },
  });
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
