#!/usr/bin/env node
/**
 * LiberiaLearn — Full Smoke Test Suite
 * Tests all API endpoints against a running server.
 * Usage: node scripts/smoke-test-full.mjs [base_url]
 * Default: http://localhost:3000
 */

const BASE = process.argv[2] || "http://localhost:3000";
const ADMIN_EMAIL = "jkollie@mca.edu.lr";
const TEACHER_EMAIL = "mpewee@mca.edu.lr";
const STUDENT_EMAIL = "fatu.wreh@mca.edu.lr";
const PASSWORD = "Password123";

let passed = 0;
let failed = 0;
const failures = [];

// ─── Helpers ─────────────────────────────────────────────────
async function getCSRFAndCookies() {
  const res = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const cookies = res.headers.getSetCookie?.() || [];
  const data = await res.json();
  return { csrfToken: data.csrfToken, cookies };
}

async function login(email, password) {
  const { csrfToken, cookies: csrfCookies } = await getCSRFAndCookies();

  const params = new URLSearchParams();
  params.set("email", email);
  params.set("password", password);
  params.set("csrfToken", csrfToken);
  params.set("json", "true");
  params.set("redirect", "false");

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

  // Collect all set-cookie headers
  const allCookies = [...csrfCookies, ...(res.headers.getSetCookie?.() || [])];
  const cookieStr = allCookies.map((c) => c.split(";")[0]).join("; ");

  return { status: res.status, cookies: cookieStr, location: res.headers.get("location") };
}

async function testEndpoint(method, path, { cookies, body, expectStatus, label } = {}) {
  const url = `${BASE}${path}`;
  const displayLabel = label || `${method} ${path}`;
  const start = Date.now();

  try {
    const opts = {
      method,
      headers: { Cookie: cookies || "", "Content-Type": "application/json" },
      redirect: "manual",
    };
    if (body && method !== "GET") {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const elapsed = Date.now() - start;
    const expected = expectStatus || 200;

    // Accept a range for some endpoints
    const ok = Array.isArray(expected)
      ? expected.includes(res.status)
      : res.status === expected;

    let responseText = "";
    try {
      responseText = await res.text();
    } catch {}

    if (ok) {
      console.log(`  [PASS] ${displayLabel} — ${res.status} — ${elapsed}ms`);
      passed++;
    } else {
      const snippet = responseText.slice(0, 100);
      console.log(`  [FAIL] ${displayLabel} — ${res.status} (expected ${expected}) — ${elapsed}ms — ${snippet}`);
      failed++;
      failures.push({ endpoint: displayLabel, status: res.status, expected, snippet });
    }

    return { status: res.status, body: responseText, ok };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`  [FAIL] ${displayLabel} — ERROR — ${elapsed}ms — ${err.message}`);
    failed++;
    failures.push({ endpoint: displayLabel, status: "ERROR", expected: expectStatus, snippet: err.message });
    return { status: 0, body: "", ok: false };
  }
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log("============================================================");
  console.log("  LIBERIALEARN — FULL SMOKE TEST");
  console.log(`  Target: ${BASE}`);
  console.log(`  Date:   ${new Date().toISOString()}`);
  console.log("============================================================\n");

  // ── Health Check ──
  console.log("[HEALTH CHECK]");
  await testEndpoint("GET", "/api/healthz", { expectStatus: 200 });

  // ── AUTH ──
  console.log("\n[AUTH]");
  const adminLogin = await login(ADMIN_EMAIL, PASSWORD);
  if (adminLogin.status >= 200 && adminLogin.status < 400) {
    console.log(`  [PASS] POST /api/auth/signin (admin) — ${adminLogin.status}`);
    passed++;
  } else {
    console.log(`  [FAIL] POST /api/auth/signin (admin) — ${adminLogin.status}`);
    failed++;
    failures.push({ endpoint: "POST /api/auth/signin (admin)", status: adminLogin.status });
  }

  // Bad credentials
  const badLogin = await login("nobody@fake.com", "wrongpassword");
  // NextAuth returns 200 with error=CredentialsSignin on bad creds or 302 to error page
  if (badLogin.status === 200 || badLogin.status === 302 || badLogin.status === 401) {
    console.log(`  [PASS] POST /api/auth/signin (bad creds) — ${badLogin.status}`);
    passed++;
  } else {
    console.log(`  [FAIL] POST /api/auth/signin (bad creds) — ${badLogin.status}`);
    failed++;
  }

  const teacherLogin = await login(TEACHER_EMAIL, PASSWORD);
  const studentLogin = await login(STUDENT_EMAIL, PASSWORD);

  const adminCookies = adminLogin.cookies;
  const teacherCookies = teacherLogin.cookies;
  const studentCookies = studentLogin.cookies;

  // ── STUDENT ──
  console.log("\n[STUDENT ENDPOINTS]");
  const todayRes = await testEndpoint("GET", "/api/student/today", { cookies: studentCookies });
  await testEndpoint("GET", "/api/student/progress", { cookies: studentCookies });
  await testEndpoint("POST", "/api/student/sync", {
    cookies: studentCookies,
    body: { items: [] },
  });

  // ── TEACHER ──
  console.log("\n[TEACHER ENDPOINTS]");
  const teacherStudents = await testEndpoint("GET", "/api/teacher/students", { cookies: teacherCookies });
  await testEndpoint("GET", "/api/teacher/schedule", { cookies: teacherCookies });
  await testEndpoint("GET", "/api/teacher/dashboard", { cookies: teacherCookies });

  // ── ADMIN ──
  console.log("\n[ADMIN ENDPOINTS]");
  await testEndpoint("GET", "/api/admin/school-branding", { cookies: adminCookies });
  await testEndpoint("PATCH", "/api/admin/school-branding", {
    cookies: adminCookies,
    body: { motto: "Excellence Through Knowledge" },
  });
  await testEndpoint("GET", "/api/admin/school-settings", { cookies: adminCookies });
  await testEndpoint("PATCH", "/api/admin/school-settings", {
    cookies: adminCookies,
    body: { approvalRequired: true },
  });
  await testEndpoint("GET", "/api/admin/guardian-link", { cookies: adminCookies });
  await testEndpoint("GET", "/api/admin/onboarding", { cookies: adminCookies });
  await testEndpoint("PATCH", "/api/admin/onboarding", {
    cookies: adminCookies,
    body: { step: 1, data: { name: "Monrovia Central Academy" } },
  });
  await testEndpoint("GET", "/api/admin/pilot-score", { cookies: adminCookies });

  // Curriculum (generate uses mode=term_plan to avoid AI dependency)
  await testEndpoint("POST", "/api/admin/curriculum/generate", {
    cookies: adminCookies,
    body: { grade: 7, subject: "MATH", topic: "Fractions Test", mode: "term_plan" },
  });
  await testEndpoint("POST", "/api/admin/curriculum/generate-full-pack", {
    cookies: adminCookies,
    body: { grade: 7, subject: "MATH", topic: "Fractions Smoke Test" },
  });

  // ── PLATFORM ──
  console.log("\n[PLATFORM ENDPOINTS]");
  await testEndpoint("GET", "/api/platform/reports?type=readiness", { cookies: adminCookies });
  await testEndpoint("POST", "/api/platform/security/transfer", { cookies: adminCookies });

  // ── NOTIFICATIONS ──
  console.log("\n[NOTIFICATION ENDPOINTS]");
  // Guardian notification needs a real studentId — try to get one
  let studentIdForNotif = null;
  try {
    if (teacherStudents.ok) {
      const data = JSON.parse(teacherStudents.body);
      if (data.students && data.students.length > 0) {
        studentIdForNotif = data.students[0].studentId;
      }
    }
  } catch {}
  if (studentIdForNotif) {
    await testEndpoint("POST", "/api/notifications/guardian", {
      cookies: teacherCookies,
      body: { studentId: studentIdForNotif, type: "flag", meta: { note: "Smoke test" } },
    });
  } else {
    console.log("  [SKIP] POST /api/notifications/guardian — no studentId available");
  }

  // ── DEMO MODE ──
  console.log("\n[DEMO MODE ENDPOINTS]");
  await testEndpoint("POST", "/api/platform/demo/reset", { cookies: adminCookies });
  await testEndpoint("POST", "/api/platform/demo/advance-day", { cookies: adminCookies });
  await testEndpoint("POST", "/api/platform/demo/simulate-activity", { cookies: adminCookies });

  // ── SUMMARY ──
  console.log("\n============================================================");
  console.log(`  SMOKE TEST COMPLETE: ${passed}/${passed + failed} passing | ${failed} failing`);
  console.log("============================================================");

  if (failures.length > 0) {
    console.log("\n  FAILURES:");
    for (const f of failures) {
      console.log(`    ${f.endpoint} — got ${f.status} (expected ${f.expected || 200})`);
      if (f.snippet) console.log(`      ${f.snippet}`);
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
