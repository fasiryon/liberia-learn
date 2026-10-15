// Loopback-only production artifact boot. No hosted configuration or write requests.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

async function main() {
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
    });
  });
  const metadata = JSON.parse(fs.readFileSync(".next/required-server-files.json", "utf8"));
  const relative = path.relative(metadata.config.outputFileTracingRoot || process.cwd(), process.cwd());
  const standalone = path.join(process.cwd(), ".next/standalone", relative, "server.js");
  const args = fs.existsSync(standalone) ? [standalone] : ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)];
  const child = spawn(process.execPath, args, { windowsHide: true, env: {
    ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1",
    DATABASE_URL: "postgresql://boot:boot@127.0.0.1:59999/unreachable_local_boot",
    DIRECT_URL: "postgresql://boot:boot@127.0.0.1:59999/unreachable_local_boot",
    NEXTAUTH_SECRET: "local-content-boot-only-not-for-deployment",
    NEXTAUTH_URL: `http://127.0.0.1:${port}`, SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "",
  } });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk.toString(); });
  child.stderr.on("data", chunk => { output += chunk.toString(); });
  let exited = false;
  child.once("exit", () => { exited = true; });
  try {
    const deadline = Date.now() + 30000;
    while (!output.includes("Ready in")) {
      if (exited || Date.now() > deadline) throw new Error("LOCAL_BOOT_NOT_READY");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(10000) });
    if (response.status !== 200 || !(await response.text()).includes("<html")) throw new Error("LOCAL_BOOT_HTTP_CHECK_FAILED");
    console.log("CONTENT LOCAL PRODUCTION BOOT: PASS (loopback homepage HTTP 200)");
  } finally {
    // This is only the child process started above, never a shared server/process.
    child.kill();
  }
}
main().catch(() => { console.error("CONTENT LOCAL PRODUCTION BOOT: FAIL"); process.exitCode = 1; });
