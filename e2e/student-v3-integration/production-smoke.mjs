/** Anonymous local production smoke only. Never supplies a session or connects to hosted data. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "artifacts/student-v3-integration";
const log = fs.createWriteStream(`${out}/production-server.log`);
const server = spawn(process.execPath, [".next/standalone/server.js"], { windowsHide: true, env: { ...process.env, NODE_ENV: "production", PORT: "3198", HOSTNAME: "127.0.0.1", DATABASE_URL: "postgresql://smoke:smoke@127.0.0.1:1/smoke", DIRECT_URL: "postgresql://smoke:smoke@127.0.0.1:1/smoke", NEXTAUTH_SECRET: "local-production-smoke-only", NEXTAUTH_URL: "http://127.0.0.1:3198" } });
server.stdout.pipe(log); server.stderr.pipe(log);
const results = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await fetch("http://127.0.0.1:3198/student/today", { redirect: "manual", signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  assert(ready, "local standalone server starts");
  for (const path of ["/student/today", "/student/learn", "/student/lesson/fixture-g7-place-value-legacy", "/student/lessons/fixture-g7-work", "/student/ai-tutor", "/student/labs", "/student/progress", "/student/textbooks", "/student/textbooks/fixture-halves"]) {
    const response = await fetch(`http://127.0.0.1:3198${path}`, { redirect: "manual" });
    const location = response.headers.get("location");
    assert([302, 303, 307, 308, 401, 403].includes(response.status), `${path} denies anonymous access (${response.status})`);
    results.push({ path, status: response.status, location });
  }
  for (const path of ["/design-preview/lessons", "/design-preview/grade-7-place-value", "/pilot-preview/textbooks"]) {
    const response = await fetch(`http://127.0.0.1:3198${path}`, { redirect: "manual" });
    assert([404, 302, 303, 307, 308, 401, 403].includes(response.status), `${path} stays unavailable in production (${response.status})`);
    results.push({ path, status: response.status, location: response.headers.get("location") });
  }
  fs.writeFileSync(`${out}/production-smoke.json`, JSON.stringify({ results, caveat: "Anonymous local standalone build. Protected-route content and authenticated school data are not exercised." }, null, 2));
  console.log("Local standalone smoke passed: 9 protected destinations deny anonymous access; 3 production previews are unavailable to anonymous requests (production route guards are also unit-tested).");
} finally { server.kill(); log.end(); }
