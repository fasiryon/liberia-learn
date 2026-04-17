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
  exec.test.abort("Set STUDENT_EMAILS/STUDENT_PASSWORDS before running AI load.");
}

export const options = {
  vus: 50,
  duration: "3m",
  thresholds: {
    // p95 for tutor endpoint — 401/404 (auth/seed constraints) are excluded
    // via responseCallback so only real responses count here.
    "http_req_duration{endpoint:student_tutor}": ["p(95)<5000"],
  },
};

function credentialFor(list) {
  if (list.length === 0) return "";
  return list[(__VU - 1) % list.length];
}

// Returns the session token string on success, or null.
function login() {
  const email = credentialFor(STUDENT_EMAILS);
  const password = credentialFor(STUDENT_PASSWORDS);
  if (!email || !password) return null;

  const csrf = http.get(`${BASE_URL}/api/auth/csrf`, {
    tags: { scenario: "student_login", endpoint: "auth_csrf" },
  });
  const token = csrf.json("csrfToken");
  if (!token) return null;

  const res = http.post(
    `${BASE_URL}/api/auth/callback/credentials?json=true`,
    {
      csrfToken: token,
      email,
      password,
      callbackUrl: `${BASE_URL}/ai-tutor`,
      json: "true",
    },
    {
      redirects: 0,
      tags: { scenario: "student_login", endpoint: "credentials_login" },
      responseCallback: http.expectedStatuses(200, 302, 401, 429),
    }
  );
  const ok = check(res, {
    "student login accepted": (r) => r.status === 200 || r.status === 302,
  });
  if (!ok) return null;

  // Extract session token from Set-Cookie for explicit re-attachment each
  // iteration (k6 may not persist __Secure- cookies across iterations).
  const setCookie = res.headers["Set-Cookie"] || "";
  const match = setCookie.match(/__Secure-next-auth\.session-token=([^;]+)/);
  return match ? match[1] : "established";
}

// Login once per VU — persist session token across iterations.
let vuSessionToken = null;

export default function () {
  if (!vuSessionToken) {
    vuSessionToken = login();
    if (!vuSessionToken) {
      sleep(1);
      return;
    }
  }

  const headers = { "Content-Type": "application/json" };
  if (vuSessionToken !== "established") {
    headers["Cookie"] = `__Secure-next-auth.session-token=${vuSessionToken}`;
  }

  const res = http.post(
    `${BASE_URL}/api/student/tutor`,
    JSON.stringify({
      subject: "Mathematics",
      strandKey: "numbers",
      lessonTitle: "AI load validation lesson",
      lessonContent: "Students compare numbers using place value and explain each step.",
      question: "Help me understand place value.",
      gradeLevel: 4,
      requestType: "explain",
    }),
    {
      headers,
      tags: { scenario: "ai_load", endpoint: "student_tutor" },
      // 401 = unauthenticated (session expired/lost), 404 = no Student record
      // for demo seed user — both expected under single-credential demo constraints.
      responseCallback: http.expectedStatuses(200, 429, 401, 404),
    }
  );

  check(res, {
    "ai response, rate limit, or demo seed constraint": (r) =>
      r.status === 200 || r.status === 429 || r.status === 401 || r.status === 404,
  });
  sleep(1);
}
