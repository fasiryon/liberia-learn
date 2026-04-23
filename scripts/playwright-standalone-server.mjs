import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");
const standaloneNext = join(standaloneRoot, ".next");

const envPath = join(root, ".env");
if (existsSync(envPath)) {
  const databaseUrlLine = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("DATABASE_URL="));
  const databaseUrl = databaseUrlLine
    ?.replace(/^\s*DATABASE_URL\s*=\s*/, "")
    .trim()
    .replace(/^["']+|["']+$/g, "");
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.includes("connection_limit=")
    ? process.env.DATABASE_URL.replace(/([?&])connection_limit=\d+/, "$1connection_limit=5")
    : `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes("?") ? "&" : "?"}connection_limit=5`;
}

process.env.__NEXT_PROCESSED_ENV = "true";
process.env.NEXTAUTH_SECRET ??= "playwright-local-secret-for-standalone-e2e";

mkdirSync(standaloneNext, { recursive: true });

const staticSource = join(root, ".next", "static");
const staticTarget = join(standaloneNext, "static");
if (existsSync(staticSource)) {
  cpSync(staticSource, staticTarget, { recursive: true, force: true });
}

const publicSource = join(root, "public");
const publicTarget = join(standaloneRoot, "public");
if (existsSync(publicSource)) {
  cpSync(publicSource, publicTarget, { recursive: true, force: true });
}

const child = spawn(process.execPath, [join(standaloneRoot, "server.js")], {
  cwd: root,
  env: {
    ...process.env,
    PORT: process.env.PORT ?? "3100",
    HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3100",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
