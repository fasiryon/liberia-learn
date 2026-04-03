#!/usr/bin/env node
/**
 * LiberiaLearn full smoke test using the canonical CHA/MOE demo accounts.
 */

const BASE = process.argv[2] || "http://localhost:3000";
const accounts = {
  admin: ["admin@cha.edu.lr", "DemoSeed2026!"],
  teacher: ["teacher1@cha.edu.lr", "DemoSeed2026!"],
  student: ["student1@cha.edu.lr", "DemoSeed2026!"],
  moe: ["official1@moe.gov.lr", "MOESeed2026!"],
};

async function getCSRFAndCookies() {
  const res = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const cookies = res.headers.getSetCookie?.() || [];
  const data = await res.json();
  return { csrfToken: data.csrfToken, cookies };
}

async function login(email, password) {
  const { csrfToken, cookies: csrfCookies } = await getCSRFAndCookies();
  const params = new URLSearchParams({
    email,
    password,
    csrfToken,
    json: "true",
    redirect: "false",
  });
  const cookieHeader = csrfCookies.map((c) => c.split(";")[0]).join("; ");
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body: params.toString(),
    redirect: "manual",
  });
  const allCookies = [...csrfCookies, ...(res.headers.getSetCookie?.() || [])];
  return {
    status: res.status,
    cookies: allCookies.map((c) => c.split(";")[0]).join("; "),
  };
}

async function get(path, cookies = "") {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });
  console.log(`${path} -> ${res.status}`);
}

async function main() {
  const sessions = {};
  for (const [key, [email, password]] of Object.entries(accounts)) {
    sessions[key] = await login(email, password);
    console.log(`login:${key} -> ${sessions[key].status}`);
  }

  await get("/api/healthz");
  await get("/student/today", sessions.student.cookies);
  await get("/teacher/students", sessions.teacher.cookies);
  await get("/admin", sessions.admin.cookies);
  await get("/platform/reports", sessions.moe.cookies);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
